export { generateDartClass };

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
                content += `  /// ${item.description}\n`;
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
                    fromJsonContent += `    ${item.name} = json['${item.name}'] is ${item.type} ? ${nestedClassName}.fromJson(json['${item.name}']) : null;\n`;
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