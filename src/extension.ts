// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';



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

// 生成dart类
function generateDartClass(className: string, dataStructure: Record<string, any>[], level: number): string {
	let nestedClass: string[] = [];
	let content = `class ${className} {\n`;
	let fromJsonContent = `  ${className}.fromJson(Map<String, dynamic> json) {\n`;
	let toJsonContent = `  Map<String, dynamic> toJson() {\n`;
	toJsonContent += `    final Map<String, dynamic> json = {};\n`;
	dataStructure.forEach((item) => {
		// code, msg
		// 首次传入level = 0
		if (item.level == -1 && level == 0) {
			content += `  /// ${item.description}\n`;
			content += `  ${item.type == 'dynamic' ? 'dynamic' : `${item.type}?`} ${item.name};\n\n`;
			fromJsonContent += `    ${item.name} = json['${item.name}'] is ${item.type} ? json['${item.name}'] : null;\n`;
			toJsonContent += `    json['${item.name}'] = ${item.name};\n`;
		}
		// data
		// 嵌套类传入的是level+1
		if (item.level == level) {
			if (item.type != 'Map<String, dynamic>' && item.type != 'List<dynamic>') {
				content += `  ///${item.description}\n`;
				content += `  ${item.type == 'dynamic' ? 'dynamic' : `${item.type}?`} ${item.name};\n\n`;
				if (item.type == 'List<String>' || item.type == 'List<int>' || item.type == 'List<double>' || item.type == 'List<bool>') {
					// 提取 'List<>' 中的类型
					const startIndex = item.type.indexOf('List<');
					const endIndex = item.type.indexOf('>', startIndex);
					const innerType = item.type.substring(startIndex + 5, endIndex);
					fromJsonContent += `    ${item.name} = json['${item.name}'] is List<dynamic> ? (json['${item.name}'] as List<dynamic>).whereType<${innerType}>().toList() : null;\n`;
				} else {
					fromJsonContent += `    ${item.name} = json['${item.name}'] is ${item.type} ? json['${item.name}'] : null;\n`;
				}
				toJsonContent += `    json['${item.name}'] = ${item.name};\n`;
			}
			else if (item.type == 'Map<String, dynamic>') {
				if (!item.children) {
					// dynamic
					content += `  ///${item.description}\n`;
					content += `  dynamic ${item.name};\n\n`;
					fromJsonContent += `    ${item.name} = json['${item.name}'];\n`;
					toJsonContent += `    json['${item.name}'] = ${item.name};\n`;
				} else {
					// 需要新建一个类T
					let nestedClassName = `${className}${item.name.charAt(0).toUpperCase() + item.name.slice(1)}`;
					content += `  ///${item.description}\n`;
					content += `  ${nestedClassName}? ${item.name};\n\n`;
					fromJsonContent += `    ${item.name} = json['${item.name}'] is ${item.type} ? ${nestedClassName}.fromJson(json['${item.name}'] ?? {}) : null;\n`;
					toJsonContent += `    json['${item.name}'] = ${item.name};\n`;
					nestedClass.push(generateDartClass(nestedClassName, !item.children ? [] : item.children, level + 1));
				}
			}
			else if (item.type == 'List<dynamic>') {
				if (!item.children) {
					// List<dynamic>
					content += `  ///${item.description}\n`;
					content += `  List<dynamic>? ${item.name};\n\n`;
					fromJsonContent += `    ${item.name} = json['${item.name}'] is List<dynamic> ? json['${item.name}'] : null;\n`;
					toJsonContent += `    json['${item.name}'] = ${item.name};\n`;
				} else {
					// 需要新建一个类List<T>
					let nestedClassName = `${className}${item.name.charAt(0).toUpperCase() + item.name.slice(1)}Item`;
					content += `  ///${item.description}\n`;
					content += `  List<${nestedClassName}>? ${item.name};\n\n`;
					fromJsonContent += `    ${item.name} = json['${item.name}'] is List<dynamic> ? (json['${item.name}'] as List<dynamic>).map((dynamic e) => ${nestedClassName}.fromJson(e is Map<String, dynamic> ? e : {})).toList() : null;\n`;
					toJsonContent += `    json['${item.name}'] = ${item.name}?.map((${nestedClassName} e) => e.toJson()).toList();\n`;
					nestedClass.push(generateDartClass(nestedClassName, !item.children ? [] : item.children, level + 1));
				}
			}
		}
	});
	content += `  ${className}();\n\n`;
	fromJsonContent += `  }\n\n`;
	toJsonContent += `    return json;\n`;
	toJsonContent += `  }\n`;
	content += fromJsonContent;
	content += toJsonContent;
	content += `}\n\n`;
	nestedClass.forEach((item) => {
		content += item;
	});
	return content;
}

// 提取List<>
function extractFromList(input: string): string | null {
	// 查找 'List<' 的起始位置
	const startIndex = input.indexOf('List<');

	// 如果找到了 'List<'
	if (startIndex !== -1) {
		// 查找 '>' 的位置
		const endIndex = input.indexOf('>', startIndex);

		// 如果找到了结束的 '>'
		if (endIndex !== -1) {
			// 提取 'List<>' 中的内容
			return input.substring(startIndex + 5, endIndex);
		}
	}
	return null; // 如果没有找到匹配的内容
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('hello-world-dart-generator.generateDartModel', async (uri: vscode.Uri) => {
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
	});

	let jsonDisposable = vscode.commands.registerCommand('hello-world-dart-generator.generateJsonFile', async (uri: vscode.Uri) => {
		if (uri && uri.fsPath && fs.lstatSync(uri.fsPath).isDirectory()) {
			// Input file name
			let fileName = await vscode.window.showInputBox({
				prompt: 'Enter the file name',
				placeHolder: 'example_data',
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
				fileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
			}
			const fullPath = path.join(uri.fsPath, fileName);

			// Read content from clipboard
			let content = await vscode.env.clipboard.readText();

			if (!content.trim().startsWith('<div') || !content.trim().endsWith('</div>') ||
				!content.includes('<tbody') || !content.includes('</tbody>')) {
				content = '// 请从torna复制整个响应参数的div';
			} else {
				// Keep only tbody
				const tbodyStart = content.indexOf('<tbody');
				const tbodyEnd = content.lastIndexOf('</tbody>') + '</tbody>'.length;
				content = content.substring(tbodyStart, tbodyEnd);

				// Convert to data structure
				try {
					let dataStructure = convertStringToJson(content);
					// Convert to nested format
					dataStructure = convertJsonToNestedFormat(dataStructure);
					content = JSON.stringify(dataStructure, null, 2);
				} catch (error) {
					content = '// html转化json失败';
				}
			}

			fs.writeFile(fullPath, content, (err) => {
				if (err) {
					vscode.window.showErrorMessage('Error creating JSON file: ' + err.message);
				} else {
					vscode.window.showInformationMessage(`${fileName} created successfully!`);
				}
			});
		}
	});

	context.subscriptions.push(disposable, jsonDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
