function getExistingItems() {
  itemIds = [];

  sessionMeta = null;

  elems = document.querySelectorAll(".product-card");

  elems.forEach((el, i) => {
    id = el.getAttribute('data-product-id');
    if (id) {
      if (sessionMeta === null) {
        obsessElem = el.nextElementSibling; // Only sibling of $(this) should be little heart "obsess" button

        sessionMeta = {
          sessionId: obsessElem.getAttribute('data-analytics-session-id'),
          csrf: obsessElem.getAttribute('data-csrf')
        };
      }

      itemIds.push(id);
    }
  });

  pageData = {
    existingItems: itemIds,
    sessionMeta: sessionMeta,
    searchUrl: window.location.href
  };

  chrome.storage.sync.set(pageData, () => {
    console.log("Overwrote sync storage with ", pageData);
  });

  return itemIds;
}

function getNewItems(existingIds, sessionMeta) {
  console.log("Retrieving new items from reloaded page");

  elems = document.querySelectorAll(".product-card");

  newItems = [];

  elems.forEach((el, i) => {
    id = el.getAttribute('data-product-id');
    if (id && !existingIds.includes(id)) {
      link = "https://www.therealreal.com" + el.getAttribute('href');
      isAvailable = el.querySelector('.product-card__status-label').innerText === "";

      item = {
        id: id,
        link: link,
        available: isAvailable
      };

      // Immediately kick off add-item request via background.js,
      // will send request status message to popup when complete
      chrome.runtime.sendMessage({
        type: 'add-item-to-cart',
        item: item,
        sessionMeta: sessionMeta
      });

      newItems.push(item);
    }
  });

  if (newItems.length === 0) {
    console.log("No new items found (" + existingIds.length + " existing)");
  } else {
    console.log("Found " + newItems.length + " new items!", newItems);
  }
  return {items: newItems};
}
