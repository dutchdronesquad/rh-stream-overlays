document.addEventListener("DOMContentLoaded", function () {
  var counters = document.querySelectorAll("[data-countup]");
  if ("IntersectionObserver" in window && counters.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    counters.forEach(function (counter) {
      observer.observe(counter);
    });
  }

  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-countup"), 10);
    if (isNaN(target)) {
      return;
    }
    var duration = 1400;
    var start = null;

    function step(timestamp) {
      if (!start) {
        start = timestamp;
      }
      var progress = Math.min((timestamp - start) / duration, 1);
      el.textContent = Math.floor(progress * target).toLocaleString();
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }
});
