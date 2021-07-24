function updateExistingItems() {
  sessionMeta = null;

  elems = document.querySelectorAll(".product-card");

  itemIds = [];
  itemDetails = [];

  elems.forEach((el, i) => {
    id = el.getAttribute('data-product-id');
    if (id) {
      link = "https://www.therealreal.com" + el.getAttribute('href');

      // Only sibling of $(this) should be little heart "obsess" button
      obsessElem = el.nextElementSibling;
      if (sessionMeta === null) {
        sessionMeta = {
          sessionId: obsessElem.getAttribute('data-analytics-session-id'),
          csrf: obsessElem.getAttribute('data-csrf')
        };
      }

      details = JSON.parse(obsessElem.getAttribute('data-analytics-attributes'));

      itemIds.push(id);
      itemDetails.push({
        id: id,
        available: (details.product_state === 'A'),
        state: details.product_state,
        price: (details.price / 100),
        name: details.name
      })
    }
  });

  pageData = {
    existingItems: itemDetails,
    existingIds: itemIds,
    sessionMeta: sessionMeta,
    searchUrl: window.location.href
  };

  chrome.storage.sync.set(pageData, () => {
    console.log("Overwrote sync storage with ", pageData);
  });
}

function getNewItems(existingIds, sessionMeta) {
  console.log("Retrieving new items from reloaded page");

  elems = document.querySelectorAll(".product-card");

  newItems = [];

  elems.forEach((el, i) => {
    id = el.getAttribute('data-product-id');
    if (id && !existingIds.includes(id)) {
      link = "https://www.therealreal.com" + el.getAttribute('href');

      item = {
        id: id,
        link: link,
      };

      // Immediately kick off add-item request via background.js,
      // will send request status message to popup when complete
      chrome.runtime.sendMessage({
        type: 'add-item-to-cart',
        item: item,
        sessionMeta: sessionMeta
      });

      obsessElem = el.nextElementSibling;
      details = JSON.parse(obsessElem.getAttribute('data-analytics-attributes'));

      newItems.push({
        ...item,
        available: (details.product_state === 'A'),
        state: details.product_state,
        price: (details.price / 100),
        name: details.name
      });
    }
  });

  if (newItems.length === 0) {
    console.log("No new items found (" + existingIds.length + " existing)");
  } else {
    console.log("Found " + newItems.length + " new items!", newItems);
  }
  return {items: newItems};
}
