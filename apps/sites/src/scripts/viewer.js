// Small progressive enhancements for a work's page. Everything works without this script:
// images link to their originals, short clips keep their controls, and the pager links are ordinary links.
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var viewer = document.querySelector("dialog[data-lightbox]");

  // Short clips play silently on a loop, unless the visitor prefers reduced motion.
  document.querySelectorAll("video[data-autoplay]").forEach(function (video) {
    if (reduceMotion) return;
    video.controls = false;
    video.play().catch(function () {
      video.controls = true;
    });
    video.addEventListener("click", function () {
      if (video.paused) video.play();
      else video.pause();
    });
  });

  // Full-size viewer: opens the original, closes on Escape, the close button or a click outside the image.
  document.addEventListener("click", function (event) {
    var target = event.target;
    var zoom = target.closest && target.closest("[data-full]");
    if (zoom && viewer) {
      event.preventDefault();
      var image = viewer.querySelector("img");
      image.src = zoom.getAttribute("data-full");
      image.alt = zoom.getAttribute("data-alt") || "";
      viewer.showModal();
    } else if (viewer && viewer.open && (target === viewer || (target.closest && target.closest("[data-close]")))) {
      viewer.close();
    }
  });

  // Left and right arrows move to the previous and next work.
  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey || (viewer && viewer.open)) return;
    var rel = event.key === "ArrowLeft" ? "prev" : event.key === "ArrowRight" ? "next" : null;
    var link = rel && document.querySelector('a[rel="' + rel + '"]');
    if (link) window.location.href = link.href;
  });
})();
