const MENU_ID = "send-link-to-audiodocs";
const AUDIODOCS_APP_URL = "https://audiodocs.cl/app";

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: "Abrir en Audiodocs",
        contexts: ["link"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn("No se pudo crear el menú de Audiodocs:", chrome.runtime.lastError.message);
        }
      },
    );
  });
}

function buildImportUrl(linkUrl) {
  try {
    const articleUrl = new URL(linkUrl);
    if (articleUrl.protocol !== "https:" && articleUrl.protocol !== "http:") {
      return null;
    }

    const audiodocsUrl = new URL(AUDIODOCS_APP_URL);
    audiodocsUrl.searchParams.set("url", articleUrl.href);
    return audiodocsUrl.href;
  } catch {
    return null;
  }
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.linkUrl) {
    return;
  }

  const importUrl = buildImportUrl(info.linkUrl);
  if (importUrl) {
    chrome.tabs.create({ url: importUrl });
  }
});
