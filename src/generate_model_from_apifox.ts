import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export { generateModelFromApifox };

// 为class增加fromJson和toJson
function addFromJsonAndToJson(classContent: string, fisrtClassName?: string): string {
    let result = classContent;

    // 获取类名
    let className = fisrtClassName || classContent.substring(classContent.indexOf('class') + 5, classContent.indexOf('{')).trim();

    // 获取匹配this. ,字符串
    let classFieldsMatches = classContent.match(/this\..*?,/g) || [];

    // 获取字段名
    let classFields = classFieldsMatches.map(field => field.replace('this.', '').replace(',', ''));

    // ? filed;的字符串, 用于获取类型
    let typeLines = classFields.map(typeLine => `? ${typeLine};`);

    let classTypes = [];

    // 获取类型
    for (let i = 0; i < typeLines.length; i++) {
        let typeLineContent = classContent.substring(0, classContent.indexOf(typeLines[i]));
        let type = typeLineContent.substring(typeLineContent.lastIndexOf('\n') + 1).trim();
        classTypes.push(type);
    }

    result = result.replace(/class.*?{/s, `class ${className} {`);

    result = result.substring(0, result.lastIndexOf(';'));
    result = result.substring(0, result.lastIndexOf(';') + 1);

    result += `\n\n    ${className}();\n\n`;

    // 增加fromJson
    result += `    ${className}.fromJson(Map<String, dynamic> json) {\n`;
    for (let i = 0; i < classFields.length; i++) {
        if (classTypes[i] === 'String' || classTypes[i] === 'int' || classTypes[i] === 'double' || classTypes[i] === 'bool') {
            result += `        ${classFields[i]} = json['${classFields[i]}'] is ${classTypes[i]} ? json['${classFields[i]}'] : null;\n`;
        } else if (classTypes[i].startsWith('List<')) {
            // 判断list中的类型
            let listType = classTypes[i].substring(5, classTypes[i].indexOf('>'));
            if (listType === 'dynamic') {
                result += `        ${classFields[i]} = json['${classFields[i]}'] is List<dynamic> ? json['${classFields[i]}'] : null;\n`;
            } else if (listType === 'String' || listType === 'int' || listType === 'double' || listType === 'bool') {
                result += `        ${classFields[i]} = json['${classFields[i]}'] is List<dynamic> ? (json['${classFields[i]}'] as List<dynamic>).whereType<${listType}>().toList() : null;\n`;
            } else {
                // 需要新建一个类T
                result += `        ${classFields[i]} = json['${classFields[i]}'] is List<dynamic> ? (json['${classFields[i]}'] as List<dynamic>).map((dynamic e) => ${listType}.fromJson(e is Map<String, dynamic> ? e : {})).toList(): null;\n`;
            }
        } else {
            result += `        ${classFields[i]} = json['${classFields[i]}'] is Map<String, dynamic> ? ${classTypes[i]}.fromJson(json['${classFields[i]}']) : null;\n`;
        }
    }
    result += `    }\n\n`;

    // 增加toJson
    result += `    Map<String, dynamic> toJson() {\n`;
    result += `        final Map<String, dynamic> json = {};\n`;
    for (let i = 0; i < classFields.length; i++) {
        result += `        json['${classFields[i]}'] = ${classFields[i]};\n`;
    }
    result += `        return json;\n`;
    result += `    }\n\n`;

    result += `}\n\n`;

    return result;
}

async function generateModelFromApifox(uri: vscode.Uri) {
    if (uri && uri.fsPath && fs.lstatSync(uri.fsPath).isDirectory()) {
        // 输入文件名
        let fileName = await vscode.window.showInputBox({
            prompt: 'Enter the file name',
            placeHolder: 'example_model',
            validateInput: (input) => {
                if (input.trim() === '') {
                    return 'File name cannot be empty';
                }
                return null;
            }
        });
        if (!fileName) {
            return; // User cancelled the input
        }
        if (fileName) {
            fileName = fileName.endsWith('.dart') ? fileName : `${fileName}.dart`;
        }
        const fullPath = path.join(uri.fsPath, fileName);

        // 转换文件名到类名（驼峰命名）
        const className = fileName.replace('.dart', '')
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');

        // 从剪贴板中读取内容
        let content = await vscode.env.clipboard.readText();

        if (!content.includes('class')) {
            content = '// 请从apifox生成代码中复制dart模型';
        } else {
            // 把class分割为数组
            let classList = content.split('\n\n\n');

            content = '';

            for (let i = 0; i < classList.length; i++) {
                // 处理class[i]，删除{}的内容，增加fromJson和toJson
                if (i === 0) {
                    content += addFromJsonAndToJson(classList[i], className);
                } else {
                    content += addFromJsonAndToJson(classList[i]);
                }
            }
        }

        fs.writeFile(fullPath, content, (err) => {
            if (err) {
                vscode.window.showErrorMessage('Error creating file: ' + err.message);
            } else {
                vscode.window.showInformationMessage(`${fileName} created successfully!`);
            }
        });
    }
}