const dashButton = document.getElementById("open-dashboard");

dashButton.onclick = () => {
  chrome.runtime.openOptionsPage();
}
