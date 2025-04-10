(function createChannel() {
  const port = chrome.runtime.connect({
    name: "nerdeRegionChromeExtension"
  });

  port.onMessage.addListener(function(message) {
    if (message?.sender?.tab?.id === chrome.devtools.inspectedWindow.tabId) {
      route(message);
    }
  });
})();

const eventsContainer = document.querySelector("#events");
const eventsList = document.querySelector("#events ol");
const regionsContainer = document.querySelector("#regions");
const persistButton = document.querySelector("#persistButton");
const accNameButton = document.querySelector("#accNameButton");
const resetButton = document.querySelector("#resetButton");
const filterStyle = document.querySelector("#filterStyle");

let pageInitialized = false;
let useCSSGroups = false;
let usePersistentLog = false;
let useAccName = false;
let watchNum = 0;

const htmlEncode = (str) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const getTimeStamp = () => {
  const currentTime = new Date();
  const padZero = (num, size) => {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
  };
  return `${padZero(currentTime.getHours(), 2)}:${padZero(
    currentTime.getMinutes(),
    2
  )}:${padZero(currentTime.getSeconds(), 2)}:${padZero(
    currentTime.getMilliseconds(),
    3
  )}`;
};

function route(message) {
  switch (message.content.action) {
    case "change":
      processIncoming(message.content);
      break;
    case "watch":
      addTab(message.content);
      processIncoming(message.content);
      break;
    case "unwatch":
      removeTab(message.content.data);
      break;
    case "initialized":
      pageInitialized = true;
      break;
    case "ready":
      processPageLoad(message.content);
      break;
  }
}

function sendToInspectedPage(message) {
  message.tabId = chrome.devtools.inspectedWindow.tabId;
  chrome.runtime.sendMessage(message);
}

function sendCommandToPage(command, data = false) {
  sendToInspectedPage({ action: "command", content: command, data: data });
}

function openInspector(path) {
  chrome.devtools.inspectedWindow.eval(
    `inspect(document.querySelector('${path}'));`
  );
}

function addTab(message) {
  const timestamp = getTimeStamp();
  watchNum = message.data.regionNum;
  addToEventList(
    `<li class="new region-${message.data.regionNum}">Region #${
      message.data.regionNum
    } is ${
      message.inDom ? "found in" : "added to"
    } DOM <div class="time">${timestamp}</div></li>`
  );
  regionsContainer.insertAdjacentHTML('beforeend', `
    <li role="none" class="region region-${message.data.regionNum}">
      <button role="tab" aria-selected="false" aria-controls="events" class="tab" data-region="${message.data.regionNum}">
        <em class="id">${message.data.regionNum}</em>${message.data.regionPath}
      </button>
    </li>`);
}

function addToEventList(html, timestamp = false) {
  const isScrollAble =
    Math.abs(
      eventsContainer.scrollTop +
        eventsContainer.offsetHeight -
        eventsContainer.scrollHeight
    ) < 10;
  eventsList.insertAdjacentHTML('beforeend', html);
  if (isScrollAble) {
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
  }
}

function panelShown() {
  if (!pageInitialized) {
    sendCommandToPage("startTrack");
  }
}

function removeTab(tabId) {
  const timestamp = getTimeStamp();
  const button = regionsContainer.querySelector(`li.region-${tabId} > button`);
  button.classList.add("gone");
  addToEventList(
    `<li class="removal region-${tabId}">Region #${tabId} was removed from DOM, or is no longer a live region <div class="time">${timestamp}</div></li>`
  );
}

function processPageLoad(message) {
  if (!message.framed) {
    const timestamp = getTimeStamp();
    if (!usePersistentLog) {
      eventsList.innerHTML = '';
      const regionElements = regionsContainer.querySelectorAll("li.region");
      regionElements.forEach(el => el.remove());
    } else {
      const buttons = regionsContainer.querySelectorAll("li.region > button");
      buttons.forEach(button => button.classList.add("gone"));
    }
    addToEventList(
      `<li class="url"><div class="ellipsis">Page Loaded [${message.data}]<div><div class="time">${timestamp}</div></li>`
    );
  }
  sendCommandToPage("startTrack", usePersistentLog ? watchNum : false);
}

function processIncoming(message) {
  const currentTime = new Date();
  const timestamp = getTimeStamp();

  let regionCode = `<li class="region region-${encodeURI(
    message.data.regionNum
  )}">`;

  regionCode += message.data.regionRole
    ? `<span class="role meta"><strong>Role:</strong> ${encodeURI(
        message.data.regionRole
      )}</span>`
    : "";

  regionCode += message.data.regionPoliteness
    ? `<span class="type meta"><strong>Politeness:</strong> ${encodeURI(
        message.data.regionPoliteness
      )}</span>`
    : "";

  regionCode += message.data.regionAtomic
    ? `<span class="atomic meta"><strong>Atomic:</strong> ${encodeURI(
        message.data.regionAtomic
      )}</span>`
    : "";

  regionCode += message.data.regionRelevant
    ? `<span class="relevant meta"><strong>Relevant:</strong> ${encodeURI(
        message.data.regionRelevant
      )}</span>`
    : "";

  regionCode += message.data.framed
    ? `<span class="frame meta"><strong>Frame:</strong> ${message.data.frameURL}</span>`
    : "";

  regionCode += `<div class="path"><em class="id">${message.data.regionNum}</em><a href="#">${message.data.regionPath}</a></div>`;

  regionCode += `<div class="content accname">${message.data.regionAccName}</div>`;

  regionCode += `<div class="content html"><pre>${htmlEncode(
    message.data.regionHTML
  )}</pre></div>`;

  regionCode += `<div class="time">${timestamp}</div>`;

  regionCode += "</li>";

  addToEventList(regionCode);
}

// Event Listeners
persistButton.addEventListener('click', function() {
  if (this.classList.contains("on")) {
    this.classList.remove("on");
    usePersistentLog = false;
  } else {
    this.classList.add("on");
    usePersistentLog = true;
  }
});

accNameButton.addEventListener('click', function() {
  if (this.classList.contains("on")) {
    this.classList.remove("on");
    eventsList.classList.remove("show-accname");
  } else {
    this.classList.add("on");
    eventsList.classList.add("show-accname");
  }
});

resetButton.addEventListener('click', function() {
  eventsList.innerHTML = '';
  const regionElements = regionsContainer.querySelectorAll("li.region");
  regionElements.forEach(el => el.remove());
  const buttons = regionsContainer.querySelectorAll("li.region > button");
  buttons.forEach(button => button.classList.add("gone"));
  sendCommandToPage("reset");
});

eventsList.addEventListener('click', function(event) {
  if (event.target.matches('.path a')) {
    event.preventDefault();
    openInspector(event.target.parentNode.querySelector('a').textContent);
  }
});

regionsContainer.addEventListener('click', function(event) {
  if (event.target.matches('li > button')) {
    eventsList.classList.remove("filtered");
    const buttons = regionsContainer.querySelectorAll("li > button");
    buttons.forEach(button => button.classList.remove("active"));
    event.target.classList.add("active");
    filterStyle.innerHTML = '';
  }
});

document.body.classList.add(chrome.devtools.panels.themeName);
