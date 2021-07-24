/* Interval slider */
intervalSlider = document.getElementById("intervalSlider");
intervalOut = document.getElementById("interval");

intervalOut.innerText = intervalSlider.value;

intervalSlider.oninput = function() {
  intervalOut.innerText = this.value;
}

initItemsButton = document.getElementById("initItems");
itemCount = document.getElementById("itemCount");

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
    function: getExistingItems, // from realrealreader.js
  },
  () => {
    chrome.storage.sync.get(['existingItems', 'searchUrl'], function(res) {
      itemCount.innerText = res.existingItems.length;

      let numAvailable, numOnHold, numSold = 0;

      for (const item of res.existingItems) {
        
      }
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
    chrome.storage.sync.get(['existingItems', 'sessionMeta'], resolve);
  });
  const cachedIds = cachedInfo.existingItems;
  const sessionMeta = cachedInfo.sessionMeta;

  console.log("Starting refresh loop at " + intervalSlider.value + " ms interval");

  var curIter = null;
  running = true;

  var refreshCount = 0;

  var startTime = null;
  while (true) {
    let intervalMs = +intervalSlider.value;

    if (curIter != null) {
      console.log("Waiting for completion...", refreshCount);
      await curIter.then((v) => console.log(refreshCount + " completed"));
    }

    if (startTime != null) {
      const pauseFor = ((startTime + intervalMs) - Date.now());
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
      const existingIds = cachedIds;
      // var existingIds;
      // if (refreshCount === 5) {
      //   console.log("TEST: remove " + cachedIds.slice(0,5) + " from existing ids");
      //   existingIds = cachedIds.slice(5);
      // } else {
      //   existingIds = cachedIds;
      // }

      startTime = Date.now();
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
    '<a href="' + item.link + '">' + item.id + '</a>' +
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
