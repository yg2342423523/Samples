/*
 * MaterialModule - 素材库管理模块
 * 
 * 功能实现：
 * 1. 素材库选择和加载功能
 * 2. 三种工作模式的实现（随机、章节、单文件）
 * 3. 弹窗式文件选择替代拖拽功能
 * 4. 素材处理和分析
 * 5. 与Prelude主程序的API集成
 * 
 * 作者: MaterialModule团队
 * 日期: 2024
 */

// 全局变量定义
var csInterface = null;                    // CEP接口实例
var currentWorkMode = 'random';            // 当前工作模式
var selectedPath = '';                     // 选中的路径
var materialFiles = [];                    // 素材文件列表
var selectedMaterials = [];                // 选中的素材文件
var isProcessing = false;                  // 是否正在处理中

// 支持的文件格式定义
var SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mxf', '.m4v', '.wmv', '.flv'];
var SUPPORTED_AUDIO_FORMATS = ['.wav', '.mp3', '.aac', '.m4a', '.wma', '.flac'];
var ALL_SUPPORTED_FORMATS = SUPPORTED_VIDEO_FORMATS.concat(SUPPORTED_AUDIO_FORMATS);

/**
 * 页面加载完成时的初始化函数
 */
function onLoaded() {
    try {
        // 尝试初始化CEP接口
        if (typeof CSInterface !== 'undefined') {
            csInterface = new CSInterface();
            
            // 加载JSX脚本
            loadJSX();
            
            // 获取应用程序信息
            var appName = csInterface.hostEnvironment.appName;
            logMessage('MaterialModule已加载，当前主应用：' + appName);
            
            // 监听来自主程序的通知
            csInterface.addEventListener("com.adobe.host.notification.SelectedAssetInfo", onHostNotification);
        } else {
            logMessage('MaterialModule已加载（演示模式 - CSInterface不可用）');
        }
        
        // 绑定模式切换事件
        bindModeChangeEvents();
        
        // 初始化UI状态
        updateUIForMode(currentWorkMode);
        
        logMessage('MaterialModule初始化完成');
        logMessage('您可以测试文件选择和模式切换功能');
        
    } catch (error) {
        // 在演示环境中忽略CSInterface相关错误
        logMessage('MaterialModule已加载（演示模式）');
        
        // 绑定模式切换事件
        bindModeChangeEvents();
        
        // 初始化UI状态
        updateUIForMode(currentWorkMode);
        
        logMessage('MaterialModule初始化完成（演示模式）');
    }
}

/**
 * 绑定工作模式切换事件
 */
function bindModeChangeEvents() {
    $('input[name="workMode"]').change(function() {
        var newMode = $(this).val();
        changeWorkMode(newMode);
    });
}

/**
 * 切换工作模式
 */
function changeWorkMode(mode) {
    currentWorkMode = mode;
    updateUIForMode(mode);
    updateModeStatus();
    logMessage('切换工作模式为：' + getModeDisplayName(mode));
}

/**
 * 根据模式更新UI界面
 */
function updateUIForMode(mode) {
    // 移除所有模式样式类
    $('body').removeClass('mode-random mode-chapter mode-single');
    
    // 添加当前模式样式类
    $('body').addClass('mode-' + mode);
    
    // 根据模式显示/隐藏相关按钮
    if (mode === 'single') {
        $('#singleFileBtn').show();
    } else {
        $('#singleFileBtn').hide();
    }
}

/**
 * 更新模式状态显示
 */
function updateModeStatus() {
    var statusText = '当前模式：' + getModeDisplayName(currentWorkMode);
    var modeDescription = getModeDescription(currentWorkMode);
    $('#modeStatus').html(statusText + '<br><small>' + modeDescription + '</small>');
}

/**
 * 获取模式显示名称
 */
function getModeDisplayName(mode) {
    switch(mode) {
        case 'random': return '随机模式';
        case 'chapter': return '章节模式';
        case 'single': return '单文件模式';
        default: return '未知模式';
    }
}

/**
 * 获取模式描述
 */
function getModeDescription(mode) {
    switch(mode) {
        case 'random': 
            return '随机选择素材文件进行处理，适合快速预览和测试';
        case 'chapter': 
            return '按文件夹结构组织素材，适合分章节的项目管理';
        case 'single': 
            return '处理单个指定文件，适合精确的单文件操作';
        default: 
            return '';
    }
}

/**
 * 选择素材库文件夹
 */
function selectMaterialLibrary() {
    try {
        logMessage('正在打开文件夹选择对话框...');
        
        // 使用CSInterface的文件夹选择功能
        // 注意：由于@electron/remote问题，我们使用替代方案
        if (typeof require !== 'undefined') {
            // Electron环境下的文件夹选择
            selectFolderElectron();
        } else {
            // 浏览器环境下的替代方案
            selectFolderFallback();
        }
        
    } catch (error) {
        logError('文件夹选择失败：' + error.message);
    }
}

/**
 * Electron环境下的文件夹选择
 */
function selectFolderElectron() {
    try {
        // 创建隐藏的文件输入元素来模拟文件夹选择
        var input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;  // 允许选择文件夹
        input.multiple = true;
        
        input.onchange = function(event) {
            var files = event.target.files;
            if (files.length > 0) {
                // 获取文件夹路径（取第一个文件的路径）
                var firstFile = files[0];
                var folderPath = firstFile.webkitRelativePath.split('/')[0];
                
                logMessage('选择了文件夹：' + folderPath);
                processFolderSelection(files, folderPath);
            }
        };
        
        input.click();
        
    } catch (error) {
        logError('Electron文件夹选择失败：' + error.message);
        selectFolderFallback();
    }
}

/**
 * 浏览器环境下的替代文件夹选择方案
 */
function selectFolderFallback() {
    // 创建文件输入元素
    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ALL_SUPPORTED_FORMATS.join(',');
    
    input.onchange = function(event) {
        var files = event.target.files;
        if (files.length > 0) {
            logMessage('选择了 ' + files.length + ' 个文件');
            processFileSelection(files, '多文件选择');
        }
    };
    
    input.click();
}

/**
 * 选择单个文件
 */
function selectSingleFile() {
    try {
        logMessage('正在打开单文件选择对话框...');
        
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = ALL_SUPPORTED_FORMATS.join(',');
        
        input.onchange = function(event) {
            var files = event.target.files;
            if (files.length > 0) {
                var file = files[0];
                logMessage('选择了单个文件：' + file.name);
                processSingleFileSelection(file);
            }
        };
        
        input.click();
        
    } catch (error) {
        logError('单文件选择失败：' + error.message);
    }
}

/**
 * 处理文件夹选择结果
 */
function processFolderSelection(files, folderPath) {
    selectedPath = folderPath;
    materialFiles = [];
    
    // 过滤支持的文件格式
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var fileName = file.name.toLowerCase();
        var isSupported = false;
        
        for (var j = 0; j < ALL_SUPPORTED_FORMATS.length; j++) {
            if (fileName.endsWith(ALL_SUPPORTED_FORMATS[j])) {
                isSupported = true;
                break;
            }
        }
        
        if (isSupported) {
            materialFiles.push({
                name: file.name,
                path: file.webkitRelativePath || file.name,
                size: file.size,
                type: getFileType(file.name),
                file: file
            });
        }
    }
    
    updateSelectionInfo();
    displayMaterialList();
    logMessage('成功加载 ' + materialFiles.length + ' 个支持的素材文件');
}

/**
 * 处理多文件选择结果
 */
function processFileSelection(files, selectionType) {
    selectedPath = selectionType;
    materialFiles = [];
    
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        materialFiles.push({
            name: file.name,
            path: file.name,
            size: file.size,
            type: getFileType(file.name),
            file: file
        });
    }
    
    updateSelectionInfo();
    displayMaterialList();
    logMessage('成功加载 ' + materialFiles.length + ' 个素材文件');
}

/**
 * 处理单文件选择结果
 */
function processSingleFileSelection(file) {
    selectedPath = file.name;
    materialFiles = [{
        name: file.name,
        path: file.name,
        size: file.size,
        type: getFileType(file.name),
        file: file
    }];
    
    updateSelectionInfo();
    displayMaterialList();
    logMessage('成功加载单个文件：' + file.name);
}

/**
 * 获取文件类型
 */
function getFileType(filename) {
    var extension = filename.toLowerCase().substr(filename.lastIndexOf('.'));
    if (SUPPORTED_VIDEO_FORMATS.indexOf(extension) !== -1) {
        return 'video';
    } else if (SUPPORTED_AUDIO_FORMATS.indexOf(extension) !== -1) {
        return 'audio';
    }
    return 'unknown';
}

/**
 * 更新选择信息显示
 */
function updateSelectionInfo() {
    $('#selectedPath').text(selectedPath);
    $('#fileCount').text(materialFiles.length);
    $('#selectionInfo').show();
    
    // 启用相关按钮
    $('#refreshBtn').prop('disabled', false);
    if (materialFiles.length > 0) {
        $('#processBtn').prop('disabled', false);
    }
}

/**
 * 显示素材文件列表
 */
function displayMaterialList() {
    var listContainer = $('#materialList');
    listContainer.empty();
    
    if (materialFiles.length === 0) {
        listContainer.html('<div style="text-align:center; color:#999; padding:20px;">未找到支持的素材文件</div>');
        return;
    }
    
    // 根据当前模式显示不同的列表样式
    switch(currentWorkMode) {
        case 'random':
            displayRandomModeList(listContainer);
            break;
        case 'chapter':
            displayChapterModeList(listContainer);
            break;
        case 'single':
            displaySingleModeList(listContainer);
            break;
    }
}

/**
 * 显示随机模式列表
 */
function displayRandomModeList(container) {
    // 随机打乱文件列表
    var shuffledFiles = materialFiles.slice().sort(function() { return 0.5 - Math.random(); });
    
    shuffledFiles.forEach(function(file, index) {
        var item = createMaterialItem(file, index);
        item.addClass('random-item');
        container.append(item);
    });
    
    logMessage('随机模式：已打乱 ' + shuffledFiles.length + ' 个文件的显示顺序');
}

/**
 * 显示章节模式列表
 */
function displayChapterModeList(container) {
    // 按文件夹路径分组
    var chapters = {};
    
    materialFiles.forEach(function(file) {
        var pathParts = file.path.split('/');
        var chapter = pathParts.length > 1 ? pathParts[0] : '根目录';
        
        if (!chapters[chapter]) {
            chapters[chapter] = [];
        }
        chapters[chapter].push(file);
    });
    
    // 按章节显示
    Object.keys(chapters).sort().forEach(function(chapterName) {
        var chapterDiv = $('<div class="chapter-group"><h4>' + chapterName + ' (' + chapters[chapterName].length + '个文件)</h4></div>');
        container.append(chapterDiv);
        
        chapters[chapterName].forEach(function(file, index) {
            var item = createMaterialItem(file, index);
            item.addClass('chapter-item');
            item.css('margin-left', '20px');
            container.append(item);
        });
    });
    
    logMessage('章节模式：已按 ' + Object.keys(chapters).length + ' 个章节组织文件');
}

/**
 * 显示单文件模式列表
 */
function displaySingleModeList(container) {
    if (materialFiles.length > 0) {
        var file = materialFiles[0];  // 只显示第一个文件
        var item = createMaterialItem(file, 0);
        item.addClass('single-item featured');
        container.append(item);
        
        if (materialFiles.length > 1) {
            var notice = $('<div style="color:#888; text-align:center; padding:10px;">单文件模式：仅显示第一个文件</div>');
            container.append(notice);
        }
    }
    
    logMessage('单文件模式：已选中第一个文件进行处理');
}

/**
 * 创建素材项目元素
 */
function createMaterialItem(file, index) {
    var sizeText = formatFileSize(file.size);
    var typeIcon = file.type === 'video' ? '🎬' : '🎵';
    
    var item = $('<div class="material-item" data-index="' + index + '">' +
        '<div style="font-weight:bold;">' + typeIcon + ' ' + file.name + '</div>' +
        '<div style="color:#666; font-size:11px;">大小: ' + sizeText + ' | 类型: ' + file.type + '</div>' +
        '<div style="color:#888; font-size:10px;">路径: ' + file.path + '</div>' +
    '</div>');
    
    // 绑定点击事件
    item.click(function() {
        toggleMaterialSelection($(this), file, index);
    });
    
    return item;
}

/**
 * 切换素材选中状态
 */
function toggleMaterialSelection(element, file, index) {
    if (element.hasClass('selected')) {
        // 取消选中
        element.removeClass('selected');
        selectedMaterials = selectedMaterials.filter(function(item) {
            return item.index !== index;
        });
    } else {
        // 选中
        element.addClass('selected');
        selectedMaterials.push({
            file: file,
            index: index,
            element: element
        });
    }
    
    // 更新预览按钮状态
    $('#previewBtn').prop('disabled', selectedMaterials.length === 0);
    
    logMessage('已选中 ' + selectedMaterials.length + ' 个素材文件');
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 处理选中的素材
 */
function processSelectedMaterials() {
    if (isProcessing) {
        logMessage('正在处理中，请等待...');
        return;
    }
    
    if (materialFiles.length === 0) {
        logError('没有可处理的素材文件');
        return;
    }
    
    isProcessing = true;
    $('#processBtn').prop('disabled', true);
    
    logMessage('开始处理素材，当前模式：' + getModeDisplayName(currentWorkMode));
    
    // 根据模式处理素材
    switch(currentWorkMode) {
        case 'random':
            processRandomMode();
            break;
        case 'chapter':
            processChapterMode();
            break;
        case 'single':
            processSingleMode();
            break;
    }
}

/**
 * 随机模式处理
 */
function processRandomMode() {
    logMessage('执行随机模式处理...');
    
    var filesToProcess = selectedMaterials.length > 0 ? 
        selectedMaterials.map(function(item) { return item.file; }) : 
        materialFiles.slice().sort(function() { return 0.5 - Math.random(); });
    
    processFilesWithProgress(filesToProcess, '随机模式处理');
}

/**
 * 章节模式处理
 */
function processChapterMode() {
    logMessage('执行章节模式处理...');
    
    var filesToProcess = selectedMaterials.length > 0 ? 
        selectedMaterials.map(function(item) { return item.file; }) : 
        materialFiles;
    
    // 按章节排序
    filesToProcess.sort(function(a, b) {
        return a.path.localeCompare(b.path);
    });
    
    processFilesWithProgress(filesToProcess, '章节模式处理');
}

/**
 * 单文件模式处理
 */
function processSingleMode() {
    logMessage('执行单文件模式处理...');
    
    var fileToProcess = selectedMaterials.length > 0 ? 
        [selectedMaterials[0].file] : 
        [materialFiles[0]];
    
    processFilesWithProgress(fileToProcess, '单文件模式处理');
}

/**
 * 带进度条的文件处理
 */
function processFilesWithProgress(files, processType) {
    var progressBar = $('#progressBar');
    var progressFill = $('#progressFill');
    
    progressBar.show();
    progressFill.css('width', '0%');
    
    var processed = 0;
    var total = files.length;
    
    logMessage(processType + '：开始处理 ' + total + ' 个文件');
    
    function processNextFile() {
        if (processed >= total) {
            // 处理完成
            finishProcessing(processType, total);
            return;
        }
        
        var file = files[processed];
        var progress = ((processed + 1) / total) * 100;
        
        // 更新进度条
        progressFill.css('width', progress + '%');
        
        // 模拟处理文件
        logMessage('正在处理: ' + file.name + ' (' + (processed + 1) + '/' + total + ')');
        
        // 调用Prelude API处理文件
        processFileWithPrelude(file, function(success) {
            processed++;
            if (success) {
                logMessage('✓ 文件处理成功: ' + file.name);
            } else {
                logError('✗ 文件处理失败: ' + file.name);
            }
            
            // 继续处理下一个文件
            setTimeout(processNextFile, 500); // 延迟500ms模拟处理时间
        });
    }
    
    processNextFile();
}

/**
 * 使用Prelude API处理文件
 */
function processFileWithPrelude(file, callback) {
    try {
        // 创建处理消息
        var taskID = newGuid();
        var msgID = newGuid();
        
        // 构建XML消息
        var messageXML = '<browserMessage>' +
            '<browserID ID="MaterialModule"/>' +
            '<taskID ID="' + taskID + '"/>' +
            '<msgID ID="' + msgID + '"/>' +
            '<filePath path="' + file.path + '"/>' +
            '<fileName>' + file.name + '</fileName>' +
            '<fileSize>' + file.size + '</fileSize>' +
            '<fileType>' + file.type + '</fileType>' +
            '<processMode>' + currentWorkMode + '</processMode>' +
            '</browserMessage>';
        
        // 记录API调用
        logApiMessage('发送处理请求: ' + file.name, messageXML);
        
        // 发送消息到Prelude
        if (csInterface) {
            csInterface.evalScript('processFile("' + encodeURIComponent(messageXML) + '")', function(result) {
                callback(result === 'success');
            });
        } else {
            // 模拟成功处理
            callback(true);
        }
        
    } catch (error) {
        logError('处理文件时发生错误: ' + error.message);
        callback(false);
    }
}

/**
 * 完成处理
 */
function finishProcessing(processType, totalFiles) {
    isProcessing = false;
    $('#processBtn').prop('disabled', false);
    $('#progressBar').hide();
    
    logMessage(processType + ' 完成！共处理了 ' + totalFiles + ' 个文件');
    
    // 显示完成通知
    showNotification('处理完成', processType + '成功处理了 ' + totalFiles + ' 个文件');
}

/**
 * 预览选中的素材
 */
function previewMaterial() {
    if (selectedMaterials.length === 0) {
        logError('请先选择要预览的素材');
        return;
    }
    
    var material = selectedMaterials[0];
    logMessage('预览素材: ' + material.file.name);
    
    // 这里可以添加预览功能的实现
    // 比如调用Prelude的预览API
    if (csInterface) {
        var previewCommand = 'previewFile("' + material.file.path + '")';
        csInterface.evalScript(previewCommand, function(result) {
            logMessage('预览结果: ' + result);
        });
    } else {
        logMessage('预览功能需要在Prelude环境中运行');
    }
}

/**
 * 刷新素材列表
 */
function refreshMaterialList() {
    logMessage('刷新素材列表...');
    displayMaterialList();
    selectedMaterials = [];
    $('#previewBtn').prop('disabled', true);
}

/**
 * 清空选择
 */
function clearSelection() {
    selectedPath = '';
    materialFiles = [];
    selectedMaterials = [];
    
    $('#selectionInfo').hide();
    $('#materialList').html('<div style="text-align:center; color:#999; padding:20px;">请先选择素材库或文件</div>');
    
    // 禁用按钮
    $('#processBtn').prop('disabled', true);
    $('#previewBtn').prop('disabled', true);
    $('#refreshBtn').prop('disabled', true);
    
    logMessage('已清空所有选择');
}

/**
 * 监听来自主程序的通知
 */
function onHostNotification(event) {
    try {
        var data = event.data;
        logMessage('收到主程序通知: ' + event.type);
        logApiMessage('主程序通知', data);
        
        // 解析通知数据
        var xmlDoc = getXMLDoc(data);
        if (xmlDoc) {
            // 处理通知内容
            handleHostNotificationData(xmlDoc);
        }
        
    } catch (error) {
        logError('处理主程序通知时发生错误: ' + error.message);
    }
}

/**
 * 处理主程序通知数据
 */
function handleHostNotificationData(xmlDoc) {
    // 这里可以根据具体的通知内容进行处理
    // 比如更新素材列表、同步选择状态等
    logMessage('正在处理主程序通知数据...');
}

/**
 * 显示通知
 */
function showNotification(title, message) {
    // 创建简单的通知弹窗
    var notification = $('<div style="position:fixed; top:20px; right:20px; background:#4CAF50; color:white; padding:15px; border-radius:5px; z-index:9999; box-shadow:0 2px 10px rgba(0,0,0,0.2);">' +
        '<strong>' + title + '</strong><br>' + message +
    '</div>');
    
    $('body').append(notification);
    
    // 3秒后自动消失
    setTimeout(function() {
        notification.fadeOut(function() {
            notification.remove();
        });
    }, 3000);
}

/**
 * 记录日志消息
 */
function logMessage(message) {
    var timestamp = new Date().toLocaleString();
    var logText = '[' + timestamp + '] ' + message + '\n';
    $('#logOutput').val($('#logOutput').val() + logText);
    
    // 自动滚动到底部
    var textarea = document.getElementById('logOutput');
    textarea.scrollTop = textarea.scrollHeight;
    
    console.log('MaterialModule: ' + message);
}

/**
 * 记录错误消息
 */
function logError(message) {
    var timestamp = new Date().toLocaleString();
    var errorText = '[' + timestamp + '] [错误] ' + message + '\n';
    $('#logOutput').val($('#logOutput').val() + errorText);
    
    var textarea = document.getElementById('logOutput');
    textarea.scrollTop = textarea.scrollHeight;
    
    console.error('MaterialModule Error: ' + message);
}

/**
 * 记录API消息
 */
function logApiMessage(title, content) {
    var timestamp = new Date().toLocaleString();
    var apiText = '*** [' + timestamp + '] ' + title + ' ***\n' + content + '\n\n';
    $('#apiMessage').val($('#apiMessage').val() + apiText);
    
    var textarea = document.getElementById('apiMessage');
    textarea.scrollTop = textarea.scrollHeight;
}

/**
 * 清空日志
 */
function clearLog() {
    $('#logOutput').val('');
    logMessage('日志已清空');
}

/**
 * 清空API消息
 */
function clearApiMessage() {
    $('#apiMessage').val('');
}

/**
 * 解析XML文档
 */
function getXMLDoc(xmlText) {
    var xmlDoc = null;
    
    try {
        if (window.DOMParser) {
            var parser = new DOMParser();
            xmlDoc = parser.parseFromString(xmlText, "text/xml");
        } else if (window.ActiveXObject) {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(xmlText);
        }
    } catch (e) {
        logError('XML解析失败: ' + e.message);
    }
    
    return xmlDoc;
}

/**
 * 加载JSX脚本
 */
function loadJSX() {
    if (csInterface && typeof SystemPath !== 'undefined') {
        var extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION) + "/jsx/";
        csInterface.evalScript('$._ext.evalFiles("' + extensionRoot + '")');
    } else {
        logMessage('JSX脚本加载跳过（演示模式）');
    }
}

/**
 * 生成新的GUID
 */
function newGuid() {
    var guid = "";
    for (var i = 1; i <= 32; i++) {
        var n = Math.floor(Math.random() * 16.0).toString(16);
        guid += n;
        if ((i == 8) || (i == 12) || (i == 16) || (i == 20))
            guid += "-";
    }
    return guid;
}

/**
 * 执行脚本
 */
function evalScript(script, callback) {
    if (csInterface) {
        csInterface.evalScript(script, callback);
    }
}