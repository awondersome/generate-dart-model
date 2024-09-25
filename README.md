# generate-dart-model

从torna复制响应参数表格的html标签生成dart model

**html 标签示例**
```
<div>
    <tbody>
        <tr class="level-0">
            <td> code </td>
            <td> string </td>
            <td> 返回码 </td>
        </tr>
        <tr class="level-0">
            <td> data </td>
            <td> object </td>
            <td> 返回的数据结果 </td>
        </tr>
        <tr class="level-1">
            <td> id </td>
            <td> integer </td>
            <td> 用户ID </td>
        </tr>
        <tr class="level-0">
            <td> String </td>
            <td> msg </td>
            <td> 提示信息 </td>
        </tr>
    </tbody>
</div>
```

**dart model 示例**
```
class ResponseModel {
  /// 返回码
  final String? code;

  /// 返回的数据结果
  final ResponseModelData? code;

  /// 提示信息
  final String? msg;

  ResponseModel();

  ResponseModel.fromJson(Map<String, dynamic> json) {
    return ResponseModel(
      code = json['code'] is String ? json['code'] : null;
      data = json['data'] is Map<String, dynamic> ? ResponseModelData.fromJson(json['data']) : null;
      msg = json['msg'] is String ? json['msg'] : null;
    );
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    json['code'] = code;
    json['data'] = data;
    json['msg'] = msg;
    return json;
  }
}

class ResponseModelData {
  /// 用户ID
  final int? id;

  ResponseModelData();

  ResponseModelData.fromJson(Map<String, dynamic> json) {
    return ResponseModelData(
      id = json['id'] is int ? json['id'] : null;
    );
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    json['id'] = id;
    return json;
  }
}
```


## 安装
**1. 选中从vsix文件安装插件**

![示例图片](assets/images/install_1.png)

**2. 导入generate-dart-model-0.0.1.vsix**

## 用法

**1. 从torna选中响应参数表格的html标签**

![示例图片](assets/images/usage_1.png)

**2. 复制整个html标签**

![示例图片](assets/images/usage_2.png)

**3. 右键文件夹选中菜单Generate Dart Model**

![示例图片](assets/images/usage_3.png)

**4. 输入文件名，使用下划线分开，会自动生成驼峰式类名**

![示例图片](assets/images/usage_4.png)

**5. 自动将粘贴板复制的html标签转化成dart model**

![示例图片](assets/images/usage_5.png)