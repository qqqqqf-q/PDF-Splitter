# PDF 垂直分割工具

将单页长PDF垂直切分成多页，输出为一个PDF文件。

# 在线使用  
[点击此处](https://qqqqqf-q.github.io/PDF-Splitter/)
## 功能

- 上传单页PDF，将其垂直切分成多个部分
- 支持快速预设：平分2份、3份、4份
- 可手动添加分割线，拖动调整位置
- 实时预览分割效果
- 输出为单个PDF文件（包含多页）

## 使用方法

1. 用浏览器打开 `index.html`
2. 点击上传或拖拽PDF文件
3. 选择预设分割方式，或手动添加/调整分割线
4. 点击"分割并下载"

## 文件结构

```
pdf-split/
├── index.html   # 主页面
├── styles.css   # 样式
├── app.js       # 逻辑代码
└── README.md
```

## 技术说明

- 纯前端实现，无需后端服务器
- 使用 PDF.js 预览PDF
- 使用 pdf-lib 进行PDF裁剪和生成
- 需要联网加载CDN资源

## 浏览器支持

Chrome、Firefox、Edge 等现代浏览器。
