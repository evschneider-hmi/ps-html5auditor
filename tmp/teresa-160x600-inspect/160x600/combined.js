const doc = document;
const win = window;
//
var bannerWidth;
var bannerHeight;
let $isi;
let $pi;
let $animateSection;
//
let $clickTag1;
let $clickTag2;
let $clickTag3;
let $clickTag4;
//
let tl;
let start_time;




if (navigator.userAgent.toLowerCase().indexOf("windows")  !== -1) {

  doc.getElementById("ISIWrapper").style.padding = "6px 0 0 4px";
  doc.getElementById("ISICopy")
    .querySelectorAll("li")
    .forEach( elem => {
      elem.classList.add("win-bullet-fix")
    })

}
let $frame1_eyebrow_in;
let $frame1_teresa_in;
let $frame1_copy_in;
let $frame1_eyebrow_out;
let $frame1_teresa_out;
let $frame1_copy_out;
let $frame1_logo_out;
let $frame2_copy_in;
let $frame2_quotes_in;
let $frame2_footnote_in;
let $frame2_copy_out;
let $frame2_quotes_out;
let $frame2_footnote_out;
let $frame2_quotes_pulse_out;
let $frame2_quotes_pulse_back;
let $frame3_logo_in;
let $frame3_eyebrow_in;
let $frame3_teresa_in;
let $frame3_copy_in;
let $frame3_cta_in;

function starAnimation(canvas, starCount) {
  for (var i=0; i<starCount; i++) {
    let star = document.createElement("div");
    star.classList.add("star", `twinkle-star-${i}`);
    canvas.append(star);
  }
}

let animate = function () {
  "use strict";

  tl.add(() => { start_time = performance.now()/1000 }, "frame1");

  tl.add("frame1", 0.5);
  // in
  tl.to($frame1_eyebrow_in, { duration: 0.5, left: '-20px' }, "frame1");
  tl.to($frame1_teresa_in, { duration: 0.5, left: '8px' }, "frame1");
  tl.to($frame1_copy_in, { duration: 0.5, left: '-2px' }, "frame1");

  tl.add("frame2", 4.0);
  // out
  tl.to($frame1_eyebrow_out, { duration: 0.5, left: '-275px' }, "frame2");
  tl.to($frame1_teresa_out, { duration: 0.5, left: '-164px' }, "frame2");
  tl.to($frame1_copy_out, { duration: 0.5, left: '-216px' }, "frame2");
  tl.to($frame1_logo_out, { duration: 0.5, left: '-198px' }, "frame2");

  // in
  tl.to($frame2_copy_in, { duration: 0.5, opacity: 1, transform: 'scale(1)' }, "frame2");
  tl.to($frame2_quotes_in, { duration: 0.5, opacity: 1, transform: 'scale(1.15)' }, "frame2");
  tl.to($frame2_footnote_in, { duration: 0.5, opacity: 1 }, "frame2");

  tl.add("frame2b", 4.5);
  // pulse
  tl.to($frame2_quotes_pulse_out, { duration: 0.25, transform: 'scale(1)' }, "frame2b");

  tl.add("frame3", 8.0);
  // out
  tl.to($frame2_copy_out, { duration: 0.5, left: '-300px' }, "frame3");
  tl.to($frame2_quotes_out, { duration: 0.5, left: '-300px' }, "frame3");
  tl.to($frame2_footnote_out, { duration: 0.5, left: '-300px' }, "frame3");

  // in
  tl.to($frame3_eyebrow_in, { duration: 0.5, left: '-20px' }, "frame3");
  tl.to($frame3_copy_in, { duration: 0.5, left: '-3px' }, "frame3");
  tl.to($frame3_cta_in, { duration: 0.5, left: '10px' }, "frame3");
  tl.to($frame3_logo_in, { duration: 0.5, left: '-3px' }, "frame3");
  tl.to($frame3_teresa_in, { duration: 0.5, left: '8px' }, "frame3");

  // animation end
  tl.call(function () {
    startISIScroll()
    console.log(performance.now()/1000 - start_time)
  });

}

// Function for initiating automatic ISI scroll
let startISIScroll = () => {
  if(window.ISIScroller) {
    ISIScroller = new window.ISIScroller(true);
    ISIScroller.start();
  }
}
let exitHandler4 = (e) =>  {
  "use strict";
  e.preventDefault();
  e.stopPropagation();
  window.open(window.clickTag4);
  Enabler.exit("clickTag4");
}
// Function to control the click on the PI link
let exitHandler3 = (e) =>  {
  "use strict";
  e.preventDefault();
  e.stopPropagation();
  window.open(window.clickTag3);
  Enabler.exit("clickTag3");
}
// Function to control the click on the PI link
let exitHandler2 = (e) =>  {
  "use strict";
  e.preventDefault();
  e.stopPropagation();
  window.open(window.clickTag2);
  Enabler.exit("clickTag2");
}
// Function to control the click on the click on the banner
let exitHandler1 = (e) =>  {
  "use strict";
  e.preventDefault();
  e.stopPropagation();
  window.open(window.clickTag1);
  Enabler.exit("clickTag1");
}

function enablerInitHandler() {
  "use strict";
  $clickTag1 = doc.querySelectorAll(".clickTag1");
  $clickTag1.forEach(function (elem) {
    elem.addEventListener("click", exitHandler1, false);
  });
  $clickTag2 = doc.querySelectorAll(".clickTag2");
  $clickTag2.forEach(function (elem) {
    elem.addEventListener("click", exitHandler2, false);
  });
  $clickTag3 = doc.querySelectorAll(".clickTag3");
  $clickTag3.forEach(function (elem) {
    elem.addEventListener("click", exitHandler3, false);
  });
  $clickTag4 = doc.querySelectorAll(".clickTag4");
  $clickTag4.forEach(function (elem) {
    elem.addEventListener("click", exitHandler4, false);
  });
  //
  $isi = doc.getElementById("ISI");
  $pi = doc.getElementById("PI");
  $animateSection = doc.getElementById("animate-section");
  bannerWidth = doc.getElementById("container").offsetWidth;
  bannerHeight = doc.getElementById("container").offsetHeight;
  //
  $frame1_eyebrow_in = doc.querySelectorAll(".frame1-eyebrow-in");
  $frame1_teresa_in = doc.querySelectorAll(".frame1-teresa-in");
  $frame1_copy_in = doc.querySelectorAll(".frame1-copy-in");
  $frame1_eyebrow_out = doc.querySelectorAll(".frame1-eyebrow-out");
  $frame1_teresa_out = doc.querySelectorAll(".frame1-teresa-out");
  $frame1_copy_out = doc.querySelectorAll(".frame1-copy-out");
  $frame1_logo_out = doc.querySelectorAll(".frame1-logo-out");
  $frame2_copy_in = doc.querySelectorAll(".frame2-copy-in");
  $frame2_quotes_in = doc.querySelectorAll(".frame2-quotes-in");
  $frame2_footnote_in = doc.querySelectorAll(".frame2-footnote-in");
  $frame2_copy_out = doc.querySelectorAll(".frame2-copy-out");
  $frame2_quotes_out = doc.querySelectorAll(".frame2-quotes-out");
  $frame2_footnote_out = doc.querySelectorAll(".frame2-footnote-out");
  $frame2_quotes_pulse_out = doc.querySelectorAll(".frame2-quotes-pulse-out");
  $frame2_quotes_pulse_back = doc.querySelectorAll(".frame2-quotes-pulse-back");
  $frame3_eyebrow_in = doc.querySelectorAll(".frame3-eyebrow-in");
  $frame3_copy_in = doc.querySelectorAll(".frame3-copy-in");
  $frame3_cta_in = doc.querySelectorAll(".frame3-cta-in");
  $frame3_logo_in = doc.querySelectorAll(".frame3-logo-in");
  $frame3_teresa_in = doc.querySelectorAll(".frame3-teresa-in");

  let regex = new RegExp("-", "g");
  for (const elem of $animateSection.children) {
    if (elem.id) {
      let elem_variable = `$${elem.id.replace(regex, '_')}`;
      win[elem_variable] = doc.getElementById(`${elem.id}`);
    }
  }


  //
  tl = gsap.timeline();
  //

  //
  animate();
}

let init = () => {
  "use strict";
  if (Enabler.isInitialized()) {
    enablerInitHandler();
  } else {
    Enabler.addEventListener(studio.events.StudioEvent.INIT, enablerInitHandler);
  }
};

init();

if (navigator.userAgent.toLowerCase().indexOf("mac")  !== -1) {
  doc.getElementById("ISIWrapper").style.paddingRight = "13px";
}
/**
 * VERSION: 1.0
 * DATE: 10-28-2015
 * AUTHOR: Richard Tolenaar
 * COMPANY: AREA23
 **/

/*
	This is an ISIscroller for banners.

	auto sets _autoScroll : true or false, defaults to true
*/

var ISIScroller = function(auto){
  var _isi;
  var _container;
  var _autoScroll = auto != undefined ? auto : true;
  var _scrollDelay;
  var _scrollDuration = 30;
  var _scrollTO;
  var _scrollSpeed;
  var _scrollerInt;
  var _scrollPoint;
  var _showISI = false;

  this.start = function(duration) {
    _isi = document.getElementById('ISICopy');
    _container = document.getElementById('ISIWrapper');
    if(window.location.host.toString().indexOf('.stage.') > -1 || window.location.host.toString().indexOf('localhost') > -1){
      if(window.location.hash.toString().indexOf('ISI') > -1){
        document.body.className += 'show-isi';
        _showISI = true;
      }
    }
    setScrollSpeed();
    if(_autoScroll) this.setScrollDelay(0);
    if (duration) {
      this.setScrollDuration(duration)
    } else {
      this.setScrollDuration(300)
    }
  }

  this.setScrollDelay = function(value){
    if(!_autoScroll) return;
    clearTimeout(_scrollTO);
    _scrollDelay = value * 1000;
    _scrollTO = setTimeout(startAutoScroll, _scrollDelay);
  }

  this.setScrollDuration = function(value){

    _scrollDuration = value;
    setScrollSpeed();
  }

  this.stop = function() {
    endISIScroll();
  }

  var doISIScroll = function(){
      if(_showISI){
        endISIScroll();
        return;
      }

      if(Math.abs(_scrollPoint - _container.scrollTop) > _scrollSpeed * 6){
        // console.log(Math.abs(_scrollPoint - _container.scrollTop) > _scrollSpeed * 4)
        endISIScroll();
      }
      if((_scrollPoint >= 0 && Math.abs(_scrollPoint) < _isi.clientHeight)){
        _container.scrollTop = _scrollPoint;
      } else if(_scrollPoint > _isi.clientHeight){
        _container.scrollTop = _isi.clientHeight;
        endISIScroll();
      }
    },

    endISIScroll = function(){
      clearTimeout(_scrollTO);
      clearInterval(_scrollerInt);
    },

    startAutoScroll = function(){
      clearInterval(_scrollerInt);
      _scrollerInt = setInterval(doAutoDownScroll, 100, _scrollSpeed);
      _isi.addEventListener("wheel", function() {
        endISIScroll();
      });
    },


    doAutoDownScroll = function(speed){
      if(Math.abs(_scrollPoint - parseInt(_isi.style.marginTop)) > speed)
        endISIScroll();
      if(!_scrollPoint) _scrollPoint = 0;
      _scrollPoint += speed;
      // doISIScroll(_scrollPoint);
      doISIScroll();

      // if(-_scrollPoint <= myScroll.maxScrollY) {
      // 	// console.log(myScroll.maxScrollY);
      // 	// console.log(-_scrollPoint)
      // 	myScroll.scrollTo(0, myScroll.maxScrollY);
      // 	endISIScroll()
      // } else {
      // 	myScroll.scrollTo(0, -_scrollPoint);	// added to handle iScroll
      // }


    },

    setScrollSpeed = function() {
      _scrollSpeed = ((_isi.clientHeight - _container.clientHeight)) / (_scrollDuration * 10);

    };
};
