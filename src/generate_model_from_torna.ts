import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import { generateDartClass } from './generate_dart_class';

export { generateModelFromTorna };

// 转换html为json
function convertStringToJson(htmlString: string): Record<string, any>[] {
    // 创建一个临时的 DOM 解析器
    const dom = new JSDOM(`<table>${htmlString}</table>`);
    const doc = dom.window.document;
    const tbody = doc.querySelector('tbody');
    const rows = doc.querySelectorAll('tr');

    // 遍历处理每一行，将每一行的数据转换为Map
    const result: Record<string, any>[] = [];
    rows.forEach((row) => {
        const rowRecord: Record<string, any> = {}
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            let key: string;
            let value: string;

            switch (index) {
                case 0:
                    key = 'name';
                    value = cell.querySelector('span:last-child')?.textContent?.trim() || '';
                    value = value.replace("复制", "");
                    break;
                case 1:
                    key = 'type';
                    value = cell.querySelector('span:first-child')?.textContent?.trim() || '';
                    value = getDartType(value);
                    break;
                case 2:
                    key = 'description';
                    value = cell.querySelector('div > div')?.textContent?.trim() || '';
                    break;
                default:
                    key = '';
                    value = '';
            }

            if (value) {
                rowRecord[key] = value;
            }
        });
        const levelClass = Array.from(row.classList).find(cls => cls.startsWith('el-table__row--level-'));
        rowRecord['level'] = levelClass ? parseInt(levelClass.split('-').pop() || '0', 10) : -1;

        if (Object.keys(rowRecord).length > 0) {
            result.push(rowRecord);
        }
    });
    return result;
}

// 转成dart类型
function getDartType(jsonType: string): string {
    switch (jsonType) {
        case 'string':
            return 'String';
        case 'int32':
        case 'int64':
        case 'integer':
            return 'int';
        case 'number':
            return 'double';
        case 'boolean':
            return 'bool';
        case 'array':
        case 'array[object]':
            return 'List<dynamic>';
        case 'array[string]':
            return 'List<String>';
        case 'array[int32]':
        case 'array[int64]':
        case 'array[integer]':
            return 'List<int>';
        case 'array[number]':
            return 'List<double>';
        case 'array[boolean]':
            return 'List<bool>';
        case 'object':
            return 'Map<String, dynamic>';
        default:
            return 'dynamic';
    }
}


// json转为嵌套格式
function convertJsonToNestedFormat(jsonData: Record<string, any>[]): Record<string, any>[] {
    const result: Record<string, any>[] = [];
    const stack: Record<string, any>[] = [];
    for (const item of jsonData) {
        if (item.level == -1) {
            result.push(item);
        } else {
            while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
                stack.pop();
            }

            if (stack.length > 0) {
                if (!stack[stack.length - 1].children) {
                    stack[stack.length - 1].children = [];
                }
                stack[stack.length - 1].children.push(item);
            } else {
                result.push(item);
            }

            stack.push(item);
        }
    }
    return result;
}

async function generateModelFromTorna(uri: vscode.Uri) {
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

        if (!content.trim().startsWith('<div') || !content.trim().endsWith('</div>') ||
            !content.includes('<tbody') || !content.includes('</tbody>')) {
            content = '// 请从torna复制整个响应参数的div';
        } else {
            // 只保留tbody
            const tbodyStart = content.indexOf('<tbody');
            const tbodyEnd = content.lastIndexOf('</tbody>') + '</tbody>'.length;
            content = content.substring(tbodyStart, tbodyEnd);

            // 转换为数据结构
            try {
                let dataStructure = convertStringToJson(content);
                // 转换为嵌套格式
                dataStructure = convertJsonToNestedFormat(dataStructure);
                // content = JSON.stringify(dataStructure, null, 2);
                content = generateDartClass(className, dataStructure, 0);
            } catch (error) {
                content = '// html转化json失败';
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