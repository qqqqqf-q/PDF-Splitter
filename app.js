// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 全局状态
const state = {
    pdfDoc: null,
    pdfBytes: null,
    originalFileName: '',  // 原始文件名
    pageWidth: 0,      // PDF原始宽度
    pageHeight: 0,     // PDF原始高度
    canvasHeight: 0,   // Canvas渲染高度
    canvasWidth: 0,    // Canvas渲染宽度
    scale: 1.5,
    splitLines: [],    // 分割线位置 (0-1 的比例)
    segments: [],      // 分割段信息
    lineIdCounter: 0
};

// 分割段配色 - 更新为新的玻璃风格配色
const colors = [
    'rgba(90, 200, 250, 0.2)',   // Blue Light
    'rgba(0, 122, 255, 0.2)',    // Blue
    'rgba(52, 199, 89, 0.2)',    // Green
    'rgba(255, 149, 0, 0.2)',    // Orange
    'rgba(175, 82, 222, 0.2)',   // Purple
    'rgba(255, 59, 48, 0.2)',    // Red
];

// DOM 元素
const elements = {
    uploadSection: document.getElementById('uploadSection'),
    uploadBox: document.getElementById('uploadBox'),
    fileInput: document.getElementById('fileInput'),
    workspace: document.getElementById('workspace'),
    addLineBtn: document.getElementById('addLineBtn'),
    splitBtn: document.getElementById('splitBtn'),
    resetBtn: document.getElementById('resetBtn'),
    segmentCount: document.getElementById('segmentCount'),
    segmentsList: document.getElementById('segmentsList'),
    pdfPreviewWrapper: document.getElementById('pdfPreviewWrapper'),
    pdfCanvas: document.getElementById('pdfCanvas'),
    splitLinesContainer: document.getElementById('splitLinesContainer')
};

// 初始化
function init() {
    setupEventListeners();
    setupMouseTracking();
}

// 设置鼠标跟踪发光效果
function setupMouseTracking() {
    document.addEventListener('mousemove', (e) => {
        // 更新全局背景发光
        const mouseGlow = document.querySelector('.mouse-glow');
        if (mouseGlow) {
            mouseGlow.style.setProperty('--mouse-x', `${e.clientX}px`);
            mouseGlow.style.setProperty('--mouse-y', `${e.clientY}px`);
        }

        // 更新所有玻璃元素的发光效果
        const glassElements = document.querySelectorAll(
            '.glass-card, .upload-card, .toolbar, .preview-panel, .segments-panel, .btn, .segment-card'
        );

        glassElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            element.style.setProperty('--mouse-x', `${x}px`);
            element.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 上传相关
    elements.uploadBox.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    // 拖拽上传
    elements.uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadBox.classList.add('dragover');
    });

    elements.uploadBox.addEventListener('dragleave', () => {
        elements.uploadBox.classList.remove('dragover');
    });

    elements.uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadBox.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            loadPDF(file);
        }
    });

    // 预设按钮
    document.querySelectorAll('.btn-icon[data-parts]').forEach(btn => {
        btn.addEventListener('click', () => {
            const parts = parseInt(btn.dataset.parts);
            applyPreset(parts);
        });
    });

    // 添加分割线按钮
    elements.addLineBtn.addEventListener('click', () => addSplitLine(0.5));

    // 分割并下载
    elements.splitBtn.addEventListener('click', splitAndDownload);

    // 重置
    elements.resetBtn.addEventListener('click', reset);
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadPDF(file);
    }
}

// 加载 PDF
async function loadPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        state.pdfBytes = new Uint8Array(arrayBuffer);

        // 保存原始文件名（去掉 .pdf 扩展名）
        state.originalFileName = file.name.replace(/\.pdf$/i, '');

        // 使用 PDF.js 加载
        state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() }).promise;

        // 获取第一页
        const page = await state.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });

        state.pageWidth = viewport.width;
        state.pageHeight = viewport.height;

        // 更新 UI
        elements.uploadSection.style.display = 'none';
        elements.workspace.style.display = 'block';

        // 渲染 PDF
        await renderPDF();

        // 默认应用3等分
        applyPreset(3);

    } catch (error) {
        console.error('加载 PDF 失败:', error);
        alert('加载 PDF 失败，请确保文件有效');
    }
}

// 渲染 PDF
async function renderPDF() {
    const canvas = elements.pdfCanvas;
    const ctx = canvas.getContext('2d');

    const page = await state.pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: state.scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    state.canvasWidth = viewport.width;
    state.canvasHeight = viewport.height;

    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;

    // 更新分割线容器尺寸
    elements.splitLinesContainer.style.width = canvas.width + 'px';
    elements.splitLinesContainer.style.height = canvas.height + 'px';
}

// 应用预设分割
function applyPreset(parts) {
    // 清除现有分割线
    state.splitLines = [];
    elements.splitLinesContainer.innerHTML = '';

    // 添加分割线 (parts-1 条线)
    for (let i = 1; i < parts; i++) {
        const position = i / parts;
        addSplitLine(position);
    }

    updateSegments();
}

// 添加分割线
function addSplitLine(position) {
    const id = ++state.lineIdCounter;

    // 确保位置在有效范围内
    position = Math.max(0.05, Math.min(0.95, position));

    // 检查是否与现有线太近
    for (const line of state.splitLines) {
        if (Math.abs(line.position - position) < 0.05) {
            position = line.position + 0.1;
            if (position > 0.95) position = line.position - 0.1;
        }
    }

    state.splitLines.push({ id, position });
    state.splitLines.sort((a, b) => a.position - b.position);

    renderSplitLine(id, position);
    updateSegments();
}

// 渲染分割线
function renderSplitLine(id, position) {
    const line = document.createElement('div');
    line.className = 'split-line';
    line.id = `line-${id}`;
    line.dataset.lineId = id;

    const y = position * state.canvasHeight;
    line.style.top = y + 'px';

    // 标签
    const handle = document.createElement('div');
    handle.className = 'line-handle';
    handle.textContent = `${Math.round(position * 100)}%`;

    // 删除按钮
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-line';
    // Use Phosphor Icon for close
    deleteBtn.innerHTML = '<i class="ph ph-x"></i>';
    deleteBtn.title = 'Remove Line';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSplitLine(id);
    });

    line.appendChild(handle);
    line.appendChild(deleteBtn);
    elements.splitLinesContainer.appendChild(line);

    // 拖动功能
    setupLineDrag(line, id);
}

// 设置分割线拖动
function setupLineDrag(lineElement, id) {
    let isDragging = false;
    let startY = 0;
    let startTop = 0;

    lineElement.addEventListener('mousedown', (e) => {
        if (e.target.closest('.delete-line')) return;
        isDragging = true;
        startY = e.clientY;
        startTop = parseInt(lineElement.style.top);
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaY = e.clientY - startY;
        let newTop = startTop + deltaY;

        // 限制范围
        newTop = Math.max(state.canvasHeight * 0.02, Math.min(newTop, state.canvasHeight * 0.98));

        lineElement.style.top = newTop + 'px';

        // 更新位置
        const newPosition = newTop / state.canvasHeight;
        const lineData = state.splitLines.find(l => l.id === id);
        if (lineData) {
            lineData.position = newPosition;
            lineElement.querySelector('.line-handle').textContent = `${Math.round(newPosition * 100)}%`;
        }

        updateSegments();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = '';
            // 重新排序
            state.splitLines.sort((a, b) => a.position - b.position);
            updateSegments();
        }
    });
}

// 删除分割线
function deleteSplitLine(id) {
    const index = state.splitLines.findIndex(l => l.id === id);
    if (index > -1) {
        state.splitLines.splice(index, 1);
        document.getElementById(`line-${id}`)?.remove();
        updateSegments();
    }
}

// 更新分割段
function updateSegments() {
    // 计算分割段
    const positions = [0, ...state.splitLines.map(l => l.position), 1];
    positions.sort((a, b) => a - b);

    state.segments = [];
    for (let i = 0; i < positions.length - 1; i++) {
        state.segments.push({
            id: i + 1,
            name: `Part ${i + 1}`,
            startRatio: positions[i],
            endRatio: positions[i + 1],
            color: colors[i % colors.length]
        });
    }

    renderSegmentsList();
    renderSegmentHighlights();
}

// 渲染分割段列表 - Updated for Swiss Design
function renderSegmentsList() {
    elements.segmentCount.textContent = state.segments.length; // Just number
    elements.segmentsList.innerHTML = '';

    state.segments.forEach((segment, index) => {
        const heightPercent = ((segment.endRatio - segment.startRatio) * 100).toFixed(1);

        const card = document.createElement('div');
        card.className = 'segment-card';
        card.innerHTML = `
            <div class="segment-header">
                <div class="color-dot" style="background: ${segment.color.replace('0.2', '1')}"></div>
                <input type="text" class="segment-name-input" value="${segment.name}" data-segment-id="${segment.id}">
            </div>
            <div class="segment-meta">
                <span><i class="ph ph-ruler"></i> ${Math.round(segment.startRatio * 100)}% - ${Math.round(segment.endRatio * 100)}%</span>
                <span>${heightPercent}% H</span>
            </div>
        `;

        // 名称修改
        card.querySelector('input').addEventListener('input', (e) => {
            segment.name = e.target.value;
        });

        // Highlight on hover
        card.addEventListener('mouseenter', () => {
            const highlight = document.querySelector(`.segment-highlight[data-id="${segment.id}"]`);
            if (highlight) highlight.style.opacity = '1';
        });
        card.addEventListener('mouseleave', () => {
            const highlight = document.querySelector(`.segment-highlight[data-id="${segment.id}"]`);
            if (highlight) highlight.style.opacity = '0';
        });

        elements.segmentsList.appendChild(card);
    });
}

// 渲染分割段高亮
function renderSegmentHighlights() {
    // 移除旧的高亮
    document.querySelectorAll('.segment-highlight').forEach(el => el.remove());

    state.segments.forEach(segment => {
        const highlight = document.createElement('div');
        highlight.className = 'segment-highlight';
        highlight.dataset.id = segment.id;

        const top = segment.startRatio * state.canvasHeight;
        const height = (segment.endRatio - segment.startRatio) * state.canvasHeight;

        highlight.style.top = top + 'px';
        highlight.style.height = height + 'px';
        highlight.style.backgroundColor = segment.color;

        const label = document.createElement('div');
        label.className = 'segment-label';
        label.textContent = segment.name;
        highlight.appendChild(label);

        elements.splitLinesContainer.appendChild(highlight);
    });
}

// 分割并下载 PDF（一个文件，多页）
async function splitAndDownload() {
    if (state.segments.length === 0) {
        alert('Please create at least one segment.');
        return;
    }

    try {
        elements.splitBtn.disabled = true;
        const originalText = elements.splitBtn.innerHTML;
        elements.splitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...';

        const { PDFDocument } = PDFLib;

        // 加载原始 PDF
        const srcDoc = await PDFDocument.load(state.pdfBytes);

        // 获取原始页面尺寸
        const srcPage = await srcDoc.getPage(0);
        const { width, height } = srcPage.getSize();

        // 创建新的PDF文档（只有一个文件）
        const newDoc = await PDFDocument.create();

        // 把每个分割段作为新的一页添加
        for (const segment of state.segments) {
            // 计算裁剪区域 (PDF坐标系从底部开始)
            const cropTop = height * (1 - segment.startRatio);
            const cropBottom = height * (1 - segment.endRatio);
            const cropHeight = cropTop - cropBottom;

            // 复制页面
            const [copiedPage] = await newDoc.copyPages(srcDoc, [0]);

            // 设置裁剪框
            copiedPage.setMediaBox(0, cropBottom, width, cropHeight);
            copiedPage.setCropBox(0, cropBottom, width, cropHeight);
            copiedPage.setBleedBox(0, cropBottom, width, cropHeight);
            copiedPage.setTrimBox(0, cropBottom, width, cropHeight);

            newDoc.addPage(copiedPage);
        }

        // 保存并下载（一个文件）
        const pdfBytes = await newDoc.save();
        const outputFileName = `${state.originalFileName}-split.pdf`;
        downloadPDF(pdfBytes, outputFileName);

        elements.splitBtn.innerHTML = originalText;
        elements.splitBtn.disabled = false;

    } catch (error) {
        console.error('分割 PDF 失败:', error);
        alert('Failed to split PDF: ' + error.message);
        elements.splitBtn.innerHTML = '<i class="ph ph-download-simple"></i> Split & Download';
        elements.splitBtn.disabled = false;
    }
}

// 下载 PDF
function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// 重置
function reset() {
    // 清除状态
    state.pdfDoc = null;
    state.pdfBytes = null;
    state.pageWidth = 0;
    state.pageHeight = 0;
    state.canvasHeight = 0;
    state.canvasWidth = 0;
    state.splitLines = [];
    state.segments = [];
    state.lineIdCounter = 0;

    // 清除 UI
    elements.splitLinesContainer.innerHTML = '';
    elements.segmentsList.innerHTML = '';
    elements.segmentCount.textContent = '0';

    const ctx = elements.pdfCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);

    // 重置文件输入
    elements.fileInput.value = '';

    // 显示上传区域
    elements.workspace.style.display = 'none';
    elements.uploadSection.style.display = 'flex';
}

// 启动应用
init();
