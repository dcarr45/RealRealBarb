chrome.runtime.onMessage.addListener(({type, item, sessionMeta}) => {
  if (type === "add-item-to-cart") {
    console.log("Adding item to cart", item);
    try {
      addItemToCart(item, sessionMeta)
        .then(response => {
          if (!response.ok) {
            console.log("Got error status: " + response.status);
            sendRequestStatus(item.id, false);
          } else {
            sendRequestStatus(item.id, true);
          }
        })
        .catch(error => {
          console.error(error);
          sendRequestStatus(item.id, false);
        });
    } catch (err) {
      console.log("Error adding item to cart: " + err);
      sendRequestStatus(item.id, false);
    }
  }
})

function sendRequestStatus(id, succeeded) {
  console.log("Sending result for id " + id + ": " + succeeded);
  chrome.runtime.sendMessage({
    type: 'add-item-result',
    id: id,
    succeeded: succeeded
  });
}

async function addItemToCart(item, sessionMeta) {
  if (!item.id) {
    return Promise.reject(new Error("Can't add item to cart, missing id"));
  }

  console.log("Adding item: " + item.id + ", " + item.link);

  const response = await fetch("https://www.therealreal.com/cart/items", {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "pragma": "no-cache",
      "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
      "sec-ch-ua-mobile": "?0",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": sessionMeta.csrf,
      "x-requested-with": "XMLHttpRequest"
    },
    "referrer": item.link,
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": "id=" + item.id + "&_analytics_session_id=" + sessionMeta.sessionId,
    "method": "POST",
    "mode": "cors",
    "credentials": "include"
  });
  return response;
}
