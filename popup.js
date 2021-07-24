/* Interval slider */
intervalSlider = document.getElementById("intervalSlider");
intervalOut = document.getElementById("interval");

intervalOut.innerText = intervalSlider.value;

intervalSlider.oninput = function() {
  intervalOut.innerText = this.value;
}

testModeSwitch = document.getElementById("testModeSwitch");
testModeOptions = document.getElementById("testModeOptions");
testNumItems = document.getElementById("testNumItems");
testDelaySeconds = document.getElementById("testDelaySeconds");

testModeSwitch.oninput = function() {
  if (testModeSwitch.checked) {
    testModeOptions.classList.remove("disabled");
  } else {
    testModeOptions.classList.add("disabled");
  }
}

initItemsButton = document.getElementById("initItems");
itemCount = document.getElementById("itemCount");
searchUrl = document.getElementById("searchUrl");
numAvailableEl = document.getElementById("numAvailable");
numOnHoldEl = document.getElementById("numOnHold");
numSoldEl = document.getElementById("numSold");


initializeItems(false);

initItemsButton.addEventListener("click", initializeItems);

async function initializeItems(refresh) {
  if (initItemsButton.classList.contains('loading')) {
    console.log("Loading already in progress");
    return;
  }

  initItemsButton.classList.add('loading');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (refresh !== false) {
    await chrome.tabs.reload(tab.id);
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: updateExistingItems, // from realrealreader.js
  },
  () => {
    chrome.storage.sync.get(['existingItems', 'searchUrl'], function(res) {
      itemCount.innerText = res.existingItems.length;
      searchUrl.innerText = res.searchUrl;

      let numAvailable = 0, numOnHold = 0, numSold = 0;

      for (const item of res.existingItems) {
        if (item.state === 'A') {
          numAvailable++;
        } else if (item.state === 'H') {
          numOnHold++;
        } else if (item.state === 'S') {
          numSold++;
        }
      }

      numAvailableEl.innerText = numAvailable;
      numOnHoldEl.innerText = numOnHold;
      numSoldEl.innerText = numSold;
    });

    initItemsButton.classList.remove('loading');
  });
}

/* Refresh logic */

startstop = document.getElementById("startstop");

// Global flag for refresh loop
var running = false;

chrome.runtime.onMessage.addListener(({type, id, succeeded}) => {
  if (type === 'add-item-result') {
    console.log("Got add-item-result for id: " + id + ", success: " + succeeded);
    let reqStatus = document.getElementById("status-" + id);
    if (succeeded) {
      console.log("Applying success for item " + id);
      reqStatus.classList.add("succeeded");
      reqStatus.innerText = "Succeeded";
    } else {
      console.log("Applying failure for item " + id);
      reqStatus.classList.add("failed");
      reqStatus.innerText = "Failed";
    }
  }
});

function doRefresh(iter, tab, existingIds, sessionMeta) {
  console.log("Called doRefresh: " + iter);

  return new Promise((onNewItems, onNoChange) => {
    chrome.tabs.reload(tab.id, {}, () => {
      console.log("Tab reloaded, injecting script");
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id, frameIds: [0] },
          func: getNewItems,
          args: [existingIds, sessionMeta]
        },
        (results) => {
          for (const res of results) {
            console.log(res);
            let newItems = res.result.items;
            if (newItems.length === 0) {
              console.log("No new items found");
              onNoChange();
            } else {
              console.log("Found new items!");
              onNewItems(newItems);
            }
          }
        }
      );
    });
  });
}

async function handleStart() {
  running = true;
  startstop.innerText = "Stop";
  startstop.classList = ["stop"];

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const cachedInfo = await new Promise(function(resolve, reject) {
    chrome.storage.sync.get(['existingIds', 'sessionMeta'], resolve);
  });
  const cachedIds = cachedInfo.existingIds;
  const sessionMeta = cachedInfo.sessionMeta;

  console.log("Starting refresh loop at " + intervalSlider.value + " ms interval");

  var curIter = null;
  running = true;

  var refreshCount = 0;

  var loopStartTime = Date.now();
  var testConditionHit = false; // Only relevant if test mode enabled

  var iterStartTime = null;

  while (true) {
    let intervalMs = +intervalSlider.value;

    if (curIter != null) {
      console.log("Waiting for completion...", refreshCount);
      await curIter.then((v) => console.log(refreshCount + " completed"));
    }

    if (iterStartTime != null) {
      const pauseFor = ((iterStartTime + intervalMs) - Date.now());
      if (pauseFor > 0) {
        console.log("Pausing for " + pauseFor + " ms");
        await new Promise(r => setTimeout(r, pauseFor));
      } else {
        console.log("Not pausing: ", pauseFor);
      }
    } else {
      console.log("startTime was null");
    }

    if (!running) {
      break;
    } else {
      var existingIds;

      if (testModeSwitch.checked && !testConditionHit) {
        let delayMs = (+testDelaySeconds.value * 1000);
        let numItems = +testNumItems.value;

        let curTime = Date.now();
        if (((loopStartTime + delayMs) - curTime) <= 0) {
          testConditionHit = true;

          console.log("TEST: remove " + cachedIds.slice(0, numItems) + " from existing ids");
          existingIds = cachedIds.slice(numItems);
        } else {
          existingIds = cachedIds;
        }
      } else {
        existingIds = cachedIds;
      }

      iterStartTime = Date.now();
      try {
        curIter = doRefresh(++refreshCount, tab, existingIds, sessionMeta)
            .then(
              newItems => {
                console.log("Done with refresh, updating summary for " + newItems.length + " new items");
                updateNewItemSummary(newItems);
                handleStop();
              },
              noChange => {
                console.log("Done with refresh, nothing to do", noChange);
              }
            ).catch(err => {
              console.log("Error while refreshing", err);
              handleStop();
            });
      } catch (err) {
        console.log("Error in call to doRefresh", err);
        handleStop();
      }
    }
  }
}

function handleStop() {
  console.log("Stopping refresh");
  running = false;
  startstop.innerText = "Start";
  startstop.classList = ["start"];
}

startstop.addEventListener("click", async () => {
  if (!running) {
    handleStart();
  } else {
    handleStop();
  }
});

newItemSummary = document.getElementById("newItemSummary");
newItemCount = document.getElementById("newItemCount");
newItemList = document.getElementById("newItemList");

function updateNewItemSummary(items) {
  newItemCount.innerText = items.length;
  for (const item of items) {
    console.log("Adding item summary for " + item.id);
    itemHtml = '<li><div>' +
    '<a href="' + item.link + '">' + item.name + '</a>' +
    '<p><b>Price: </b><span class="itemPrice">$' + item.price + '</span></p>' +
    '<p><b>Available: </b>';
    if (item.available) {
      itemHtml += '<span class="yesAvailable">Yes</span>';
    } else {
      itemHtml += '<span class="noAvailable">No</span>';
    }
    itemHtml += '</p>' +
    '<p><b>Request status: </b><span class="requestStatus" id="status-' + item.id + '">Pending</span></p>' +
    '</div></li>';

    newItemList.innerHTML += itemHtml;
  }
  console.log("Enabling new item summary");
  newItemSummary.classList.remove("disabled");
}

closeItemSummaryButton = document.getElementById("closeItemSummary");
closeItemSummaryButton.onclick = () => {
  newItemCount.innerText = "0";
  newItemList.innerHTML = "";
  newItemSummary.classList.add("disabled");
}
