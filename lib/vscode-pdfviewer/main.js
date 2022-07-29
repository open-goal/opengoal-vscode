"use strict";

(function () {
  function loadConfig() {
    const elem = document.getElementById('pdf-preview-config')
    if (elem) {
      return JSON.parse(elem.getAttribute('data-config'))
    }
    throw new Error('Could not load configuration.')
  }
  function cursorTools(name) {
    if (name === 'hand') {
      return 1
    }
    return 0
  }
  function scrollMode(name) {
    switch (name) {
      case 'vertical':
        return 0
      case 'horizontal':
        return 1
      case 'wrapped':
        return 2
      default:
        return -1
    }
  }
  function spreadMode(name) {
    switch (name) {
      case 'none':
        return 0
      case 'odd':
        return 1
      case 'even':
        return 2
      default:
        return -1
    }
  }
  window.addEventListener('load', function () {
    const config = loadConfig()
    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
    let finalPath = config.path.split("#page=")[0];
    let decodedUri = unescape(config.path);
    let pageNum = parseInt(decodedUri.split("#page=")[1]);
    PDFViewerApplication.open(finalPath)
    PDFViewerApplication.initializedPromise.then(() => {
      const defaults = config.defaults
      const optsOnLoad = () => {
        PDFViewerApplication.pdfCursorTools.switchTool(cursorTools(defaults.cursor))
        PDFViewerApplication.pdfViewer.currentScaleValue = defaults.scale
        PDFViewerApplication.pdfViewer.currentPageNumber = pageNum;
        PDFViewerApplication.pdfViewer.scrollMode = scrollMode(defaults.scrollMode)
        PDFViewerApplication.pdfViewer.spreadMode = spreadMode(defaults.spreadMode)
        if (defaults.sidebar) {
          PDFViewerApplication.pdfSidebar.open()
        } else {
          PDFViewerApplication.pdfSidebar.close()
        }
        PDFViewerApplication.eventBus.off('documentloaded', optsOnLoad)
      }
      PDFViewerApplication.eventBus.on('documentloaded', optsOnLoad)
    })
    window.addEventListener('message', function () {
      console.log("hello world");
      const { currentPageNumber, currentScaleValue } = PDFViewerApplication.pdfViewer
      PDFViewerApplication.open(config.path).then(() => {
        const optsOnReload = () => {
          PDFViewerApplication.pdfViewer.currentPageNumber = currentPageNumber
          PDFViewerApplication.pdfViewer.currentScaleValue = currentScaleValue
          PDFViewerApplication.eventBus.off('documentloaded', optsOnReload)
        }
        PDFViewerApplication.eventBus.on('documentloaded', optsOnReload)
      })
    });
  }, { once: true });

  window.onerror = function () {
    const msg = document.createElement('body')
    msg.innerText = 'An error occurred while loading the file. Please open it again.'
    document.body = msg
  }
}());
