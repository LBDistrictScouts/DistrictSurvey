// Maps clean addresses to the exported pages: /survey becomes /survey.html.
// Based on DistrictInfrastructure/modules/cloudfront-distribution/clean-urls.js.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/") {
    return request;
  }

  if (uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  var finalSegment = uri.slice(uri.lastIndexOf("/") + 1);
  if (finalSegment && !finalSegment.includes(".")) {
    request.uri = uri + ".html";
  }

  return request;
}
