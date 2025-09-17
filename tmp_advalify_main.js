
//remove query parameters to get a clean URL for bookmarks
if(document.location.href.indexOf('flyer')==-1) {
    //history.replaceState({},document.title,location.protocol+'//'+location.hostname+location.pathname);
} 
  
function myEach(selector,func,parent_id) {
    if(parent_id==null) var inputs = document.getElementsByClassName(selector);
    else {
        var p = (typeof parent_id == 'string') ? document.getElementById(parent_id) : parent_id;
        var inputs = p.getElementsByClassName(selector);
    }
    Array.prototype.filter.call(inputs, function(element, index, array){
        try{
            (func.bind(element))();
        } catch(e) {}
    });
}
function show(o) {
    if(typeof o != 'object') o = getObject(o);
    if(!o) {console.log("show(): "+o+" doesn't exist."); return;}
    o.style.display = (o.nodeName == 'DIV') ? (o.classList.contains('inline')?'inline-block':'block') : '';
}
function hide(o) {
    if(typeof o != 'object') o = getObject(o);
    if(!o) {console.log("hide(): "+o+" doesn't exist."); return;}
    o.style.display = 'none';
}
function toggle(id,bool) {
    if(typeof bool == 'boolean') {
        if(bool) show(id); else hide(id);
        return;
    }
    if(isVisible(id)) hide(id); else show(id);
}
function toggleClass(o,c) {
    if(typeof o != 'object') o = getObject(o);
    if(o.classList.contains(c)) o.classList.remove(c);
    else o.classList.add(c);
}
function isVisible(o) {
    if(typeof o != 'object') o = getObject(o);
    if(!o) {console.log("isVisible(): "+o+" doesn't exist."); return;}
    var s = window.getComputedStyle(o);
    return (s.display !== 'none');
}

function showtab(t,v) {
    v = (v!==undefined) ? '_'+v : '';
    for(i=1; i<=10; i++) {
        if(getObject('tab'+i+v)) getObject('tab'+i+v).className = (t==i) ? 'on' : '';
        if(getObject('tabdiv'+i+v)) getObject('tabdiv'+i+v).style.display = (t==i) ? '' : 'none';
    }
}
function gototop(smooth) {
    if(smooth) {
        scroll({
          top: 0,
          behavior: 'smooth'
        });
    } else {
        window.scrollTo(0, 0);
    }
}
function scrollToElement(id,block) {
    var o = (typeof id == 'object') ? id : document.getElementById(id);
    o.scrollIntoView({
        behavior: 'smooth',
        block: block||'start'
    });
}
function foolproof(str) {
    var div = document.createElement('div');
    var text = document.createTextNode(str);
    div.appendChild(text);
    return div.innerHTML;
}

var addonReq = new Array();
var addonReq_opacitytimers = new Array();
function getaddon(url,parameters,showdiv,callback,noeffect,nosplit) {
    noeffect = 1;
    if(url===null) url = document.location.pathname;
    
    if(addonReq[showdiv]) {
        try {addonReq[showdiv].abort();}
        catch (err) {}
    }
    
    if(getObject(showdiv)) {
        if(getObject(showdiv).nodeName=='DIV') if(noeffect!=1) {
            clearTimeout(addonReq_opacitytimers[showdiv]);
            addonReq_opacitytimers[showdiv] = window.setTimeout(function() {
                if(getObject(showdiv)) getObject(showdiv).style.opacity = 0.5;
            },200);
        }
    }
    
    addonReq[showdiv] = null;
    addonReq[showdiv] = new XMLHttpRequest();
    addonReq[showdiv].open("POST",url,true);
    addonReq[showdiv].setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    addonReq[showdiv].onreadystatechange = function() {
        if(addonReq[showdiv]) {
            if(addonReq[showdiv].readyState==4 && addonReq[showdiv].status==200) {
                //if(!getObject(showdiv)) {console.log('This DIV does not exist: '+showdiv); return;}
                if(getObject('progressbar_'+showdiv)) {
                    progressBar.finish(null,showdiv);
                }
                var response = addonReq[showdiv].responseText.split('-=-=-');
                if(response[1] && response[1].substring(0,1)=='{') {
                    var json = JSON.parse(response[1]) || {};
                    if(json.reload) {
                        document.location.href = document.location.href;
                        return;
                    }
                    if(json.logout) {
                        document.location.href = '/logout';
                        return;
                    }
                    if(json.shake) {
                        shake(json.shake);
                        if(json.msg) mynotification.open(json.msg);
                    }
                    if(json.error) {
                        setTimeout(function(){
                            myconfirm.open(json.error,json.message||'',json.func);
                        },(json.shake?1000:0));
                    }
                    response[1] = json;
                }
                if(getObject(showdiv)) {
                    var nodename = getObject(showdiv).nodeName;
                    if(nodename=="DIV") {
                        getObject(showdiv).innerHTML = response[0];
                        clearTimeout(addonReq_opacitytimers[showdiv]);
                        getObject(showdiv).style.opacity = 1;
                    } else if(nodename=="INPUT") {
                        getObject(showdiv).value = response[0];
                    } else if(nodename=="SELECT") {
                        getObject(showdiv).innerHTML = response[0];
                    } else if(nodename=="TEXTAREA") {
                        getObject(showdiv).value = response[0];
                    } else if(nodename=="IMAGE") {
                        getObject(showdiv).src = response[0];
                    } else if(nodename=="SPAN") {
                        getObject(showdiv).innerHTML = response[0];
                    } else if(nodename=="IMG") {
                        getObject(showdiv).src = response[0];
                    }
                }
                docready_things();
                if(window[callback]) {
                    window[callback](response[1]);
                } else if(typeof callback === 'function') {
                    callback(response[1]);
                }
            }
        }
    }
    addonReq[showdiv].send(parameters);
}
function callbackerror(status) {
    if(status===undefined) return false;
    status = status.split('###');
    if(status[0]=='ERR0') return true;
    if(status[0]=='ERR1') {
        try {
            if(getObject(status[1])) {
                window.setTimeout(function() {
                    if(getObject(status[1]).focus && !getObject(status[1]).disabled) getObject(status[1]).focus();
                    shake(getObject(status[1]));
                },200);
            }
            if(status[2]) myconfirm.open("That didn't work",status[2]);
        } catch(e) {}
        return true;
    }
    return false;
}
/*
function shake(o,focus) {
    if(typeof o != 'object') o = getObject(o);
    if(!o) {console.log("shake(): "+o+" doesn't exist."); return;}
    if(o.nodeName=='SELECT') o = getObject(o.id+'_div');
    if(!o) return;
    o.classList.remove('shake');
    window.setTimeout(function(){ o.classList.add('shake'); },50);
    window.setTimeout(function(){ o.classList.remove('shake'); },2000);
    if(focus!==false) setFocus(o);
}
*/
function shake(o,focus) {
    if(typeof o != 'object') o = getObject(o);
    if(!o) {console.log("shake(): "+o+" doesn't exist."); return;}
    if(o.nodeName=='SELECT') o = getObject(o.id+'_div');
    if(o.nodeName=='INPUT' && getObject('div_wrapper_radioicon_'+o.id)) {
        o = getObject('div_wrapper_radioicon_'+o.id);
    }
    if(o.nodeName=='INPUT' && getObject(o.id+'_div')) {
        o = getObject(o.id+'_div');
        o.classList.add('myselect_on');
    }
    if(!o) return;
    
    if((tabdiv = o.closest("[id^='tabdiv']")) && tabdiv!=o) {
        if(!isVisible(tabdiv)) {
            var d = tabdiv.id.replace('div','');
            getObject(d) && getObject(d).dispatchEvent(new Event('mousedown'));
        }
    }
    o.classList.remove('shake');
    window.setTimeout(function(){ o.classList.add('shake'); },50);
    window.setTimeout(function(){ o.classList.remove('shake'); },2000);
    o.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if(focus!==false) setFocus(o);
}
/*
function wrapformdata(form) {
    if(!form) return '';
    var p='', len=form.elements.length;
    for(i=0; i<len; i++) {
        var obj = form.elements[i];
        var name = (obj.type=='radio') ? obj.id : obj.name;
          if(name=='') continue;
        var value = (obj.type=='checkbox' || obj.type=='radio') ? obj.checked : obj.value;
        p += '&'+name+'='+encodeURIComponent(value+'');
    }
    return p;
}
*/
function wrapformdata(form) {
    if(!form) return '';
    var p='', len=form.elements.length;
    for(i=0; i<len; i++) {
        var value = '', obj = form.elements[i];
        if(obj.type=='submit') continue;
        if(obj.getAttribute('data-wrapformdata') == 'no') continue;
        var name = obj.id || obj.name || '';
          if(name=='') continue;
        if(obj.type=='checkbox') {
            if(name.substring(0,7)=='omnibox') continue;
            value = obj.checked;
        } else if(obj.type=='radio') {
            if(obj.checked) {
                name = obj.name;
                value = obj.value;
            } else continue;
        } else {
            if(name.indexOf('input_search')!=-1) continue;
            value = obj.value;
        }
        p += '&'+name+'='+encodeURIComponent(value+'');
    }
    return p;
}
function getObject(el) {
    return document.getElementById(el);
}

function showmodal1(w,h) {
    if(isVisible('div_modal1_wrapper')==false) {
        var html_el = document.getElementsByTagName("html")[0];
        var width_html1 = parseFloat(window.getComputedStyle( document.body ).width);
        html_el.style.overflowY = 'hidden';
        var width_html2 = parseFloat(window.getComputedStyle( document.body ).width);
        html_el.style.marginRight = (width_html2-width_html1)+"px";
    }
    
    w = w || parseInt(h * 0.618);
    h = h || parseInt(w * 0.618);
    
    if(w>0) getObject('showdiv_modal1').style.width = w+'px';
    if(h>0) getObject('showdiv_modal1').style.height = h+'px';
    show('div_modal1_wrapper');
    getObject('showdiv_modal1').scrollTop = 0;
}
function closemodal1() {
    getObject('showdiv_modal1').innerHTML = '';
    hide('div_modal1_wrapper');
    var html_el = document.getElementsByTagName("html")[0];
    html_el.style.overflowY = 'scroll';
    html_el.style.marginRight = "0px";
}

function showmodal2(w,h) {
    if(isVisible('div_modal1_wrapper')==false && isVisible('div_modal2_wrapper')==false) {
        var html_el = document.getElementsByTagName("html")[0];
        var width_html1 = parseFloat(window.getComputedStyle( document.body ).width);
        html_el.style.overflowY = 'hidden';
        var width_html2 = parseFloat(window.getComputedStyle( document.body ).width);
        html_el.style.marginRight = (width_html2-width_html1)+"px";
    }
    
    w = w || parseInt(h * 0.618);
    h = h || parseInt(w * 0.618);
    
    if(w>0) getObject('showdiv_modal2').style.width = w+'px';
    if(h>0) getObject('showdiv_modal2').style.height = h+'px';
    show('div_modal2_wrapper');
    getObject('showdiv_modal2').scrollTop = 0;
}
function closemodal2() {
    getObject('showdiv_modal2').innerHTML = '';
    hide('div_modal2_wrapper');
    if(isVisible('div_modal1_wrapper')==false) {
        var html_el = document.getElementsByTagName("html")[0];
        html_el.style.overflowY = 'scroll';
        html_el.style.marginRight = "0px";
    }
}

function actual(el,what) {
    var s = window.getComputedStyle(el);
    var d = s.display; //remember
    el.style.opacity = 1;
    el.style.display = 'inherit';
    var wh = (what=='width') ? el.offsetWidth : el.offsetHeight;
    el.style.display = d;
    el.style.opacity = 1;
    return wh || 0;
}
var adglareBox = {
    lastid: '',
    closed_all: true,
    show: function(id,el,event,leftright,delay,cb,matchwidth) {
        leftright = leftright || 'right';
        delay = delay || 0;
        event = event || null;
        if(event) event.stopPropagation();
        if(isVisible(id)) {
            adglareBox.hide(id);
            return;
        }
        
        //set width?
        if(matchwidth===1) {
            var el_width = getObject(el).offsetWidth || 100;
            getObject(id).style.width = el_width+'px';
        }
        
        //calculate position
        adglareBox.closed_all = false;
        if(this.lastid!='' && this.lastid != id) adglareBox.hide(this.lastid);
        this.lastid = id;
        var el_top=0, el_left=0, el_height=0, el_width=0;
        
        var pop_width = actual(getObject(id),'width');
        var pop_height = actual(getObject(id),'height');
        try {
            var rect = el.getClientRects();
            el_top = Math.ceil(rect[0].top) || 0;
            el_left = Math.ceil(rect[0].left) || 0;
            el_height = Math.ceil(rect[0].height) || 0;
            el_width = Math.ceil(rect[0].width) || 0;
        } catch(e) {}
        
        if(el_top==0 || el_left==0) {
            if(event) {
                el_top = parseInt(event.clientY + 20);
                el_left = parseInt(event.clientX);
            }
        }
        
        //orientation
        var transformOrigin = 'left';
        var translateX = el_left;
        if(leftright=='right' || (el_left + pop_width + 60 > window.innerWidth)) {
            var transformOrigin = 'right';
            var translateX = el_left + el_width - pop_width;
        } else if(leftright=='center') {
            var transformOrigin = 'center';
            var translateX = (el_left + (el_width/2)) - (pop_width/2);
        }
        
        //height
        var translateY = el_top + el_height + 10;
        if(translateY + pop_height + 50 > window.innerHeight) {
            translateY = window.innerHeight - pop_height - 50;
        }
        
        //$('#'+id).css({'transform':'translateX('+translateX+'px) translateY('+translateY+'px)'});
        getObject(id).style.left = translateX+'px';
        getObject(id).style.top = translateY+'px';
        getObject(id+'_inner').style.transformOrigin = transformOrigin+' top 0px';
        
        //for scrolling
        var top = 0;
        try{ top = parseInt(document.body.scrollTop || document.documentElement.scrollTop); } catch(e) {}
        if(getObject(id)) {
            getObject(id).setAttribute('data-adglare-translate',translateY);
            getObject(id).setAttribute('data-adglare-scroll-top',top);
        } else {
            console.log('Error: this adglareBox() id does not exist: '+id);
        }
        window.setTimeout(function(){
            show(id);
            if(typeof cb === 'function') cb();
        },delay);
    },
    hide: function(id,delay) {
        delay = delay || 0;
        if(delay==0) {
            hide(id);
            return;
        }
        window.setTimeout(function(){
            getObject(id).classList.add('animatedfast');
            getObject(id).classList.add('fadeOut');
            window.setTimeout(function(){
                getObject(id).classList.remove('animatedfast');
                getObject(id).classList.remove('fadeOut');
                hide(id);
            },300);
        },delay);
    },
    hideAll: function() {
        myEach('adglarebox',function(){
            adglareBox.hide(this.id);
        });
    },
    isOpened: function() {
        var a = false;
        myEach('adglarebox',function(){
            if(isVisible(this.id)) {
                a = true;
            }
        });
        return a;
    },
    init: function() {
        document.addEventListener('mousedown', function(e){
            adglareBox.hideAll();
        });
        document.addEventListener('scroll', function(e){
            adglareBox.hideAll();
            /*
            myEach('adglarebox',function(){
                if(isVisible(this.id)) {
                    var top = 0;
                    try{ top = parseInt(document.body.scrollTop || document.documentElement.scrollTop); } catch(e) {}
                    var translateY = parseInt(this.getAttribute('data-adglare-translate'));
                    var original_top = parseInt(this.getAttribute('data-adglare-scroll-top'));
                    var diff = parseInt(original_top - top);
                    var new_translateY = parseInt(translateY + diff);
                    this.style.top = new_translateY+'px';
                }
            });
            */
        });
    },
    elInId: function(el,id) {
        if(!el) return false;
        if(el.id == id) return true;
        var parent = el.parentNode;
        return (parent && 1 === parent.nodeType) ? adglareBox.elInId(parent,id) : false;
    }
}
adglareBox.init();
document.addEventListener('keyup', function(e){
    if(e.keyCode == 27) {
        if(isVisible('div_modal2_wrapper')==true) closemodal2();
        else closemodal1();        
        adglareBox.hideAll();
        myconfirm.hide();
    }
});

var myconfirm = {
    _func: function() {},
    open: function(title,text,func,is_remove) {
        this._func = func; //if no function passed, it will be an OK box
        show('div_myconfirm_background');
        getObject('div_myconfirm_title').innerHTML = title;
        getObject('div_myconfirm_text').innerHTML = text;
        
        if(typeof func == 'function') {
            show('btn_myconfirm_cancel');
            hide('btn_myconfirm_ok');
            if(is_remove===false) {
                show('btn_myconfirm_confirm');
                hide('btn_myconfirm_remove');                
            } else {
                hide('btn_myconfirm_confirm');
                show('btn_myconfirm_remove');                  
            }
        } else {
            hide('btn_myconfirm_cancel');
            hide('btn_myconfirm_remove');
            hide('btn_myconfirm_confirm');
            show('btn_myconfirm_ok');
        }
        show('div_myconfirm');
    },
    hide: function() {
        hide('div_myconfirm');
        hide('div_myconfirm_background');
    },
    submit: function() {
        this.hide();
        this._func();
    },
    isVisible: function() {
        return isVisible('div_myconfirm');
    }
}
var mynotification = {
    _timer: null,
    open: function(text,timeout) {
        clearTimeout(this._timer);
        var timeout = timeout || 4000;
        text = "<span class=mat>emoji_people</span>"+text;
        getObject('div_mynotification').innerHTML = text;
        getObject('div_mynotification').classList.remove('on');
        getObject('div_mynotification').classList.add('on');
        this._timer = setTimeout(function(){ mynotification.close(); },timeout);
    },
    close: function() {
        clearTimeout(this._timer);
        getObject('div_mynotification').classList.remove('on');
    }
}
function logAWConversion() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-1053500645';
    var el = document.getElementsByTagName('script')[0];
    el.parentNode.insertBefore(s, el);
    
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'AW-1053500645');    
    gtag('event', 'conversion', {
        'send_to': 'AW-1053500645/TEb6CMm9t1sQ5cms9gM',
        'value': 0.0,
        'currency': 'USD'
    });
}

/*! highlight.js v9.12.0 | BSD3 License | git.io/hljslicense */
!function(e){var n="object"==typeof window&&window||"object"==typeof self&&self;"undefined"!=typeof exports?e(exports):n&&(n.hljs=e({}),"function"==typeof define&&define.amd&&define([],function(){return n.hljs}))}(function(e){function n(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function t(e){return e.nodeName.toLowerCase()}function r(e,n){var t=e&&e.exec(n);return t&&0===t.index}function a(e){return k.test(e)}function i(e){var n,t,r,i,o=e.className+" ";if(o+=e.parentNode?e.parentNode.className:"",t=B.exec(o))return w(t[1])?t[1]:"no-highlight";for(o=o.split(/\s+/),n=0,r=o.length;r>n;n++)if(i=o[n],a(i)||w(i))return i}function o(e){var n,t={},r=Array.prototype.slice.call(arguments,1);for(n in e)t[n]=e[n];return r.forEach(function(e){for(n in e)t[n]=e[n]}),t}function u(e){var n=[];return function r(e,a){for(var i=e.firstChild;i;i=i.nextSibling)3===i.nodeType?a+=i.nodeValue.length:1===i.nodeType&&(n.push({event:"start",offset:a,node:i}),a=r(i,a),t(i).match(/br|hr|img|input/)||n.push({event:"stop",offset:a,node:i}));return a}(e,0),n}function c(e,r,a){function i(){return e.length&&r.length?e[0].offset!==r[0].offset?e[0].offset<r[0].offset?e:r:"start"===r[0].event?e:r:e.length?e:r}function o(e){function r(e){return" "+e.nodeName+'="'+n(e.value).replace('"',"&quot;")+'"'}s+="<"+t(e)+E.map.call(e.attributes,r).join("")+">"}function u(e){s+="</"+t(e)+">"}function c(e){("start"===e.event?o:u)(e.node)}for(var l=0,s="",f=[];e.length||r.length;){var g=i();if(s+=n(a.substring(l,g[0].offset)),l=g[0].offset,g===e){f.reverse().forEach(u);do c(g.splice(0,1)[0]),g=i();while(g===e&&g.length&&g[0].offset===l);f.reverse().forEach(o)}else"start"===g[0].event?f.push(g[0].node):f.pop(),c(g.splice(0,1)[0])}return s+n(a.substr(l))}function l(e){return e.v&&!e.cached_variants&&(e.cached_variants=e.v.map(function(n){return o(e,{v:null},n)})),e.cached_variants||e.eW&&[o(e)]||[e]}function s(e){function n(e){return e&&e.source||e}function t(t,r){return new RegExp(n(t),"m"+(e.cI?"i":"")+(r?"g":""))}function r(a,i){if(!a.compiled){if(a.compiled=!0,a.k=a.k||a.bK,a.k){var o={},u=function(n,t){e.cI&&(t=t.toLowerCase()),t.split(" ").forEach(function(e){var t=e.split("|");o[t[0]]=[n,t[1]?Number(t[1]):1]})};"string"==typeof a.k?u("keyword",a.k):x(a.k).forEach(function(e){u(e,a.k[e])}),a.k=o}a.lR=t(a.l||/\w+/,!0),i&&(a.bK&&(a.b="\\b("+a.bK.split(" ").join("|")+")\\b"),a.b||(a.b=/\B|\b/),a.bR=t(a.b),a.e||a.eW||(a.e=/\B|\b/),a.e&&(a.eR=t(a.e)),a.tE=n(a.e)||"",a.eW&&i.tE&&(a.tE+=(a.e?"|":"")+i.tE)),a.i&&(a.iR=t(a.i)),null==a.r&&(a.r=1),a.c||(a.c=[]),a.c=Array.prototype.concat.apply([],a.c.map(function(e){return l("self"===e?a:e)})),a.c.forEach(function(e){r(e,a)}),a.starts&&r(a.starts,i);var c=a.c.map(function(e){return e.bK?"\\.?("+e.b+")\\.?":e.b}).concat([a.tE,a.i]).map(n).filter(Boolean);a.t=c.length?t(c.join("|"),!0):{exec:function(){return null}}}}r(e)}function f(e,t,a,i){function o(e,n){var t,a;for(t=0,a=n.c.length;a>t;t++)if(r(n.c[t].bR,e))return n.c[t]}function u(e,n){if(r(e.eR,n)){for(;e.endsParent&&e.parent;)e=e.parent;return e}return e.eW?u(e.parent,n):void 0}function c(e,n){return!a&&r(n.iR,e)}function l(e,n){var t=N.cI?n[0].toLowerCase():n[0];return e.k.hasOwnProperty(t)&&e.k[t]}function p(e,n,t,r){var a=r?"":I.classPrefix,i='<span class="'+a,o=t?"":C;return i+=e+'">',i+n+o}function h(){var e,t,r,a;if(!E.k)return n(k);for(a="",t=0,E.lR.lastIndex=0,r=E.lR.exec(k);r;)a+=n(k.substring(t,r.index)),e=l(E,r),e?(B+=e[1],a+=p(e[0],n(r[0]))):a+=n(r[0]),t=E.lR.lastIndex,r=E.lR.exec(k);return a+n(k.substr(t))}function d(){var e="string"==typeof E.sL;if(e&&!y[E.sL])return n(k);var t=e?f(E.sL,k,!0,x[E.sL]):g(k,E.sL.length?E.sL:void 0);return E.r>0&&(B+=t.r),e&&(x[E.sL]=t.top),p(t.language,t.value,!1,!0)}function b(){L+=null!=E.sL?d():h(),k=""}function v(e){L+=e.cN?p(e.cN,"",!0):"",E=Object.create(e,{parent:{value:E}})}function m(e,n){if(k+=e,null==n)return b(),0;var t=o(n,E);if(t)return t.skip?k+=n:(t.eB&&(k+=n),b(),t.rB||t.eB||(k=n)),v(t,n),t.rB?0:n.length;var r=u(E,n);if(r){var a=E;a.skip?k+=n:(a.rE||a.eE||(k+=n),b(),a.eE&&(k=n));do E.cN&&(L+=C),E.skip||(B+=E.r),E=E.parent;while(E!==r.parent);return r.starts&&v(r.starts,""),a.rE?0:n.length}if(c(n,E))throw new Error('Illegal lexeme "'+n+'" for mode "'+(E.cN||"<unnamed>")+'"');return k+=n,n.length||1}var N=w(e);if(!N)throw new Error('Unknown language: "'+e+'"');s(N);var R,E=i||N,x={},L="";for(R=E;R!==N;R=R.parent)R.cN&&(L=p(R.cN,"",!0)+L);var k="",B=0;try{for(var M,j,O=0;;){if(E.t.lastIndex=O,M=E.t.exec(t),!M)break;j=m(t.substring(O,M.index),M[0]),O=M.index+j}for(m(t.substr(O)),R=E;R.parent;R=R.parent)R.cN&&(L+=C);return{r:B,value:L,language:e,top:E}}catch(T){if(T.message&&-1!==T.message.indexOf("Illegal"))return{r:0,value:n(t)};throw T}}function g(e,t){t=t||I.languages||x(y);var r={r:0,value:n(e)},a=r;return t.filter(w).forEach(function(n){var t=f(n,e,!1);t.language=n,t.r>a.r&&(a=t),t.r>r.r&&(a=r,r=t)}),a.language&&(r.second_best=a),r}function p(e){return I.tabReplace||I.useBR?e.replace(M,function(e,n){return I.useBR&&"\n"===e?"<br>":I.tabReplace?n.replace(/\t/g,I.tabReplace):""}):e}function h(e,n,t){var r=n?L[n]:t,a=[e.trim()];return e.match(/\bhljs\b/)||a.push("hljs"),-1===e.indexOf(r)&&a.push(r),a.join(" ").trim()}function d(e){var n,t,r,o,l,s=i(e);a(s)||(I.useBR?(n=document.createElementNS("http://www.w3.org/1999/xhtml","div"),n.innerHTML=e.innerHTML.replace(/\n/g,"").replace(/<br[ \/]*>/g,"\n")):n=e,l=n.textContent,r=s?f(s,l,!0):g(l),t=u(n),t.length&&(o=document.createElementNS("http://www.w3.org/1999/xhtml","div"),o.innerHTML=r.value,r.value=c(t,u(o),l)),r.value=p(r.value),e.innerHTML=r.value,e.className=h(e.className,s,r.language),e.result={language:r.language,re:r.r},r.second_best&&(e.second_best={language:r.second_best.language,re:r.second_best.r}))}function b(e){I=o(I,e)}function v(){if(!v.called){v.called=!0;var e=document.querySelectorAll("pre code");E.forEach.call(e,d)}}function m(){addEventListener("DOMContentLoaded",v,!1),addEventListener("load",v,!1)}function N(n,t){var r=y[n]=t(e);r.aliases&&r.aliases.forEach(function(e){L[e]=n})}function R(){return x(y)}function w(e){return e=(e||"").toLowerCase(),y[e]||y[L[e]]}var E=[],x=Object.keys,y={},L={},k=/^(no-?highlight|plain|text)$/i,B=/\blang(?:uage)?-([\w-]+)\b/i,M=/((^(<[^>]+>|\t|)+|(?:\n)))/gm,C="</span>",I={classPrefix:"hljs-",tabReplace:null,useBR:!1,languages:void 0};return e.highlight=f,e.highlightAuto=g,e.fixMarkup=p,e.highlightBlock=d,e.configure=b,e.initHighlighting=v,e.initHighlightingOnLoad=m,e.registerLanguage=N,e.listLanguages=R,e.getLanguage=w,e.inherit=o,e.IR="[a-zA-Z]\\w*",e.UIR="[a-zA-Z_]\\w*",e.NR="\\b\\d+(\\.\\d+)?",e.CNR="(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)",e.BNR="\\b(0b[01]+)",e.RSR="!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~",e.BE={b:"\\\\[\\s\\S]",r:0},e.ASM={cN:"string",b:"'",e:"'",i:"\\n",c:[e.BE]},e.QSM={cN:"string",b:'"',e:'"',i:"\\n",c:[e.BE]},e.PWM={b:/\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/},e.C=function(n,t,r){var a=e.inherit({cN:"comment",b:n,e:t,c:[]},r||{});return a.c.push(e.PWM),a.c.push({cN:"doctag",b:"(?:TODO|FIXME|NOTE|BUG|XXX):",r:0}),a},e.CLCM=e.C("//","$"),e.CBCM=e.C("/\\*","\\*/"),e.HCM=e.C("#","$"),e.NM={cN:"number",b:e.NR,r:0},e.CNM={cN:"number",b:e.CNR,r:0},e.BNM={cN:"number",b:e.BNR,r:0},e.CSSNM={cN:"number",b:e.NR+"(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",r:0},e.RM={cN:"regexp",b:/\//,e:/\/[gimuy]*/,i:/\n/,c:[e.BE,{b:/\[/,e:/\]/,r:0,c:[e.BE]}]},e.TM={cN:"title",b:e.IR,r:0},e.UTM={cN:"title",b:e.UIR,r:0},e.METHOD_GUARD={b:"\\.\\s*"+e.UIR,r:0},e});hljs.registerLanguage("javascript",function(e){var r="[A-Za-z$_][0-9A-Za-z$_]*",t={keyword:"in of if for while finally var new function do return void else break catch instanceof with throw case default try this switch continue typeof delete let yield const export super debugger as async await static import from as",literal:"true false null undefined NaN Infinity",built_in:"eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Error EvalError InternalError RangeError ReferenceError StopIteration SyntaxError TypeError URIError Number Math Date String RegExp Array Float32Array Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect Promise"},a={cN:"number",v:[{b:"\\b(0[bB][01]+)"},{b:"\\b(0[oO][0-7]+)"},{b:e.CNR}],r:0},n={cN:"subst",b:"\\$\\{",e:"\\}",k:t,c:[]},c={cN:"string",b:"`",e:"`",c:[e.BE,n]};n.c=[e.ASM,e.QSM,c,a,e.RM];var s=n.c.concat([e.CBCM,e.CLCM]);return{aliases:["js","jsx"],k:t,c:[{cN:"meta",r:10,b:/^\s*['"]use (strict|asm)['"]/},{cN:"meta",b:/^#!/,e:/$/},e.ASM,e.QSM,c,e.CLCM,e.CBCM,a,{b:/[{,]\s*/,r:0,c:[{b:r+"\\s*:",rB:!0,r:0,c:[{cN:"attr",b:r,r:0}]}]},{b:"("+e.RSR+"|\\b(case|return|throw)\\b)\\s*",k:"return throw case",c:[e.CLCM,e.CBCM,e.RM,{cN:"function",b:"(\\(.*?\\)|"+r+")\\s*=>",rB:!0,e:"\\s*=>",c:[{cN:"params",v:[{b:r},{b:/\(\s*\)/},{b:/\(/,e:/\)/,eB:!0,eE:!0,k:t,c:s}]}]},{b:/</,e:/(\/\w+|\w+\/)>/,sL:"xml",c:[{b:/<\w+\s*\/>/,skip:!0},{b:/<\w+/,e:/(\/\w+|\w+\/)>/,skip:!0,c:[{b:/<\w+\s*\/>/,skip:!0},"self"]}]}],r:0},{cN:"function",bK:"function",e:/\{/,eE:!0,c:[e.inherit(e.TM,{b:r}),{cN:"params",b:/\(/,e:/\)/,eB:!0,eE:!0,c:s}],i:/\[|%/},{b:/\$[(.]/},e.METHOD_GUARD,{cN:"class",bK:"class",e:/[{;=]/,eE:!0,i:/[:"\[\]]/,c:[{bK:"extends"},e.UTM]},{bK:"constructor",e:/\{/,eE:!0}],i:/#(?!!)/}});hljs.registerLanguage("xml",function(s){var e="[A-Za-z0-9\\._:-]+",t={eW:!0,i:/</,r:0,c:[{cN:"attr",b:e,r:0},{b:/=\s*/,r:0,c:[{cN:"string",endsParent:!0,v:[{b:/"/,e:/"/},{b:/'/,e:/'/},{b:/[^\s"'=<>`]+/}]}]}]};return{aliases:["html","xhtml","rss","atom","xjb","xsd","xsl","plist"],cI:!0,c:[{cN:"meta",b:"<!DOCTYPE",e:">",r:10,c:[{b:"\\[",e:"\\]"}]},s.C("<!--","-->",{r:10}),{b:"<\\!\\[CDATA\\[",e:"\\]\\]>",r:10},{b:/<\?(php)?/,e:/\?>/,sL:"php",c:[{b:"/\\*",e:"\\*/",skip:!0}]},{cN:"tag",b:"<style(?=\\s|>|$)",e:">",k:{name:"style"},c:[t],starts:{e:"</style>",rE:!0,sL:["css","xml"]}},{cN:"tag",b:"<script(?=\\s|>|$)",e:">",k:{name:"script"},c:[t],starts:{e:"</script>",rE:!0,sL:["actionscript","javascript","handlebars","xml"]}},{cN:"meta",v:[{b:/<\?xml/,e:/\?>/,r:10},{b:/<\?\w+/,e:/\?>/}]},{cN:"tag",b:"</?",e:"/?>",c:[{cN:"name",b:/[^\/><\s]+/,r:0},t]}]}});hljs.registerLanguage("css",function(e){var c="[a-zA-Z-][a-zA-Z0-9_-]*",t={b:/[A-Z\_\.\-]+\s*:/,rB:!0,e:";",eW:!0,c:[{cN:"attribute",b:/\S/,e:":",eE:!0,starts:{eW:!0,eE:!0,c:[{b:/[\w-]+\(/,rB:!0,c:[{cN:"built_in",b:/[\w-]+/},{b:/\(/,e:/\)/,c:[e.ASM,e.QSM]}]},e.CSSNM,e.QSM,e.ASM,e.CBCM,{cN:"number",b:"#[0-9A-Fa-f]+"},{cN:"meta",b:"!important"}]}}]};return{cI:!0,i:/[=\/|'\$]/,c:[e.CBCM,{cN:"selector-id",b:/#[A-Za-z0-9_-]+/},{cN:"selector-class",b:/\.[A-Za-z0-9_-]+/},{cN:"selector-attr",b:/\[/,e:/\]/,i:"$"},{cN:"selector-pseudo",b:/:(:)?[a-zA-Z0-9\_\-\+\(\)"'.]+/},{b:"@(font-face|page)",l:"[a-z-]+",k:"font-face page"},{b:"@",e:"[{;]",i:/:/,c:[{cN:"keyword",b:/\w+/},{b:/\s/,eW:!0,eE:!0,r:0,c:[e.ASM,e.QSM,e.CSSNM]}]},{cN:"selector-tag",b:c,r:0},{b:"{",e:"}",i:/\S/,c:[e.CBCM,t]}]}});hljs.registerLanguage("json",function(e){var i={literal:"true false null"},n=[e.QSM,e.CNM],r={e:",",eW:!0,eE:!0,c:n,k:i},t={b:"{",e:"}",c:[{cN:"attr",b:/"/,e:/"/,c:[e.BE],i:"\\n"},e.inherit(r,{b:/:/})],i:"\\S"},c={b:"\\[",e:"\\]",c:[e.inherit(r)],i:"\\S"};return n.splice(n.length,0,t,c),{c:n,k:i,i:"\\S"}});


window.addEventListener('click', function(e){
    myEach('div_myselect',function(){myselect_hide(this.id.substring(0,this.id.length-4)); });
});
function myselect_hide(id) {
    hide(id+'_div_inner');
    getObject(id+'_div').classList.remove('myselect_on');
}
function myselect_open(id,obj) {
    myselect_resetsearch(id);
    if(isVisible(id+'_div_inner')) {
        hide(id+'_div_inner');
        return;
    }
    myEach('div_myselect_inner',function(){
        if(this.id != id) myselect_hide(this.id.substring(0,this.id.length-10));
    });
    
    //default
    var top = '34px';
    var bottom = 'inherit';
    var maxheight = 500;
    var topbottom = 'top';
    getObject(id+'_div').classList.add('myselect_on');
    
    try {
        if(obj.getClientRects()) {
            var thispos = parseInt(obj.getClientRects()[0].y);
            var winheight = parseInt(window.innerHeight);
            if(thispos > winheight/2) {
                //most space available at the top
                top = 'inherit';
                bottom = '34px';
                topbottom = 'bottom';
                
                if(getObject(id).closest('#showdiv_modal2')) {
                    var start_y = parseInt(getObject(id).closest('#showdiv_modal2').getClientRects()[0].y) + 155;
                    maxheight = thispos - start_y;
                } else if(getObject(id).closest('#showdiv_modal1')) {
                    var start_y = parseInt(getObject(id).closest('#showdiv_modal1').getClientRects()[0].y) + 155;
                    maxheight = thispos - start_y;
                } else {
                    var start_y = 20;
                    maxheight = thispos - start_y;
                }
            } else {
                //most space available at the bottom
                var top = '34px';
                var bottom = 'inherit';
                var topbottom = 'top';
                
                if(getObject(id).closest('#showdiv_modal2')) {
                    var start_y = parseInt(getObject(id).closest('#showdiv_modal2').getClientRects()[0].bottom) - 85 - 55;
                    maxheight = start_y - thispos;
                } else if(getObject(id).closest('#showdiv_modal1')) {
                    var start_y = parseInt(getObject(id).closest('#showdiv_modal1').getClientRects()[0].bottom) - 85 - 55;
                    maxheight = start_y - thispos;
                } else {
                    maxheight = winheight - thispos - 55;
                }
            }
        }
    } catch(e) {}
    
    getObject(id+'_div_inner').style.top = top;
    getObject(id+'_div_inner').style.bottom = bottom;
    getObject(id+'_div_inner').style.maxHeight = maxheight+'px';
    show(id+'_div_inner');
    
    //scroll to selected item
    var sel = document.querySelector('#'+id+'_div_inner .div_myselect_option_selected');
    if(sel) {
        var topPos = sel.offsetTop;
        getObject(id+'_div_inner').scrollTop = topPos - 100;
    }
    
    //focus search field (if any)
    var s = document.querySelector('#'+id+'_div_inner .div_myselect_search');
    if(s && isVisible(s)) setFocus(id+'_input_search');
}
function myselect_set(id, key, value, type) {
    var key = atob(key);
    if(type=='select') {
        getObject(id).value = key;
        if(value === undefined) {
            value = '';
            try {
                value = getObject(id).options[getObject(id).selectedIndex].text;
            } catch(e) {}
        } else {
            value = decodeURIComponent(escape(atob(value)));
        }
        myEach('div_myselect_option',function(){this.classList.remove('div_myselect_option_selected');},getObject(id+'_div'));
        getObject('div_myselect_option_'+id+'_'+key).classList.add('div_myselect_option_selected');
    } else if(type=='checkbox') {
        var a = JSON.parse(getObject(id).value) || [];
        if(getObject('checkbox_myselect_'+id+'_'+key).checked) {
            a.push(key);
        } else {
            if(a.indexOf(key)!=-1) a.splice(a.indexOf(key),1);
        }
        value = (a.length==0) ? '' : a.length+' selected';
        getObject(id).value = JSON.stringify(a);
    } else if(type=='radio') {
        getObject(id).value = key;
        value = atob(value);
    }
    if(getObject(id+'_div_placeholder').innerHTML == value) return;
    getObject(id+'_div_placeholder').innerHTML = (value=='&nbsp;') ? '&nbsp;' : (getObject(id+'_div').getAttribute('data-foolproof')=='1' ? foolproof(value) : value);
}

function myselect_resetsearch(id,obj) {
    getObject(id+'_input_search').value = '';
    hide(id+'_div_nothingfound');
    myEach('div_myselect_optgroup',function(){show(this);});
    myEach('div_myselect_option',function(){show(this);});
}
function myselect_search(id) {
    var q = trim(getObject(id+'_input_search').value.toLowerCase());
    if(q=='') {
        myselect_resetsearch(id);
        return;
    }
    myEach('div_myselect_optgroup',function(){hide(this);});
    hide(id+'_div_nothingfound');
    var n_found = 0;
    myEach('div_myselect_option',function(){
        var data = this.getAttribute('data-search').toLowerCase();;
        if(data.indexOf(q)>=0) {
            show(this);
            n_found++;
        } else {
            hide(this);
        }
    },id+'_div');
    if(n_found==0) show(id+'_div_nothingfound');
}
function copyToClipboard(value) {
    var t = document.createElement("textarea"), d = document;
    t.style = "position: absolute; left: -1000px; top: -1000px";
    t.value = value;
    d.body.appendChild(t);
    t.select();
    d.execCommand("copy");
    d.body.removeChild(t);
    
    mynotification.open('Copied to clipboard!');
}
function goto(url) {
    document.location.href = url;
}
/*
function signupMessage() {
    myconfirm.open('FREE Account',"To change and save settings, you need an account. It's free. Create one now?",function(){getsignup('settings');},100);
}
var login_last_code = '';
function getsignup(cta) {
    cta = cta || '';
    showmodal2(450,450,1,1);
    getaddon('/@signup','cta='+cta,'showdiv_modal2',function(status) {
        if(status=='ALREADY_LOGGED_ON') {
            document.location.href = 'https://app.advalify.io';
            return; 
        }
        setTimeout(function(){ setFocus('advalify_em'); },300);
        setInterval(function(){
            if(!getObject('advalify_logincode')) return;
            var v = getObject('advalify_logincode').value;
            if(v!=login_last_code && v.length==6) {
                login_last_code = v;
                loginaction('login',document.signupform);
            }
        },100);
    });
}
*/
function personaaction(action,data,meta) {
    if(action=='get') {
        showmodal2(500,530);
        getaddon('/@settings','personaaction=1&action='+action,'showdiv_modal2',function(r){
            
        });
    } else if(action=='save') {
        closemodal2();
        getaddon('/@settings','personaaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            mynotification.open('Thanks!');
        });
    }
}
function loginaction(action,data,meta) {
    if(action=='get') {
        show('div_login_wrapper');
        document.documentElement.style.overflowY = 'hidden';
        getaddon('/@settings','loginaction=1&action='+action+'&callback='+(data||'')+'&meta='+(meta||'')+'&email='+(localStorage.getItem('email')||''),'showdiv_login',function(r) {
            if(r && r.refresh) {
                document.location.href = document.location.href;
                return;
            }
            setFocus('email');
        });
    } else if(action=='send') {
        getaddon('/@settings','loginaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                if(r.forward_to_app) {
                    document.location.href = 'https://app.advalify.io/?email='+r.email;
                    return;
                } else if(r.refresh) {
                    document.location.href = document.location.href;
                    return;
                } else {
                    getObject('span_email_txt').innerHTML = foolproof(getObject('email').value);
                    hide('div_login2');
                    show('div_login2');
                    initAccessCode();
                    setFocus('code1');
                }
            }
        });
    } else if(action=='check') {
        getObject('btn_check_access_code').disabled = true;
        getaddon('/@settings','loginaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            getObject('btn_check_access_code').disabled = false;
            if(r && r.ok) {
                localStorage.setItem('has_account','yes');
                localStorage.setItem('email',r.email);
                document.location.href = document.location.href;
            }
        });
    }
}
function snippetaction(action,data,meta) {
    if(action=='get') {
        showmodal2(800);
        getaddon('/@settings','snippetaction=1&action='+action+'&data='+(data||''),'showdiv_modal2',function(r) {
        });
    }
}

function reviewaction(action,data,meta) {
    if(action=='get') {
        showmodal2(0,600);
        getaddon('/@settings','reviewaction=1&action='+action+'&project_id='+data,'showdiv_modal2',function(r) {
            if(r && r.require_signup) {
                loginaction('get','review');
                return;
            }
        });
    } else if(action=='submit') {
        getaddon('/@settings','reviewaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                scanaction('get',r.job_id);
            }
        });
    }
}
function joinaction(action,data,meta) {
    if(action=='get') {
        showmodal2(500,600);
        getaddon('/@settings','joinaction=1&action='+action+'&what='+(data||''),'showdiv_modal2',function(r) {
            if(r && r.require_signup) {
                closemodal2();
                loginaction('get','add_users');
                return;
            }
            setFocus('email_1');
        });
    } else if(action=='send') {
        getaddon('/@settings','joinaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                if(r.count>1) mynotification.open('Invite emails sent');
                else mynotification.open('Invite email sent');
            }
        });
    }
}
function clientuploadaction(action,data,meta) {
    if(action=='get') {
        showmodal2(500,800);
        var folder_id = localStorage.getItem('folder_id') || 0;
        getaddon('/@settings','clientuploadaction=1&action='+action+'&folder_id='+folder_id,'showdiv_modal2',function(r) {
        });
    } else if(action=='save') {
        getaddon('/@settings','clientuploadaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
            }
        });
    }
}
function ssoaction(action,data,meta) {
    if(action=='get') {
        showmodal2(700,500);
        getaddon('/@settings','ssoaction=1&action='+action,'showdiv_modal2',function(r) {
        });
    } else if(action=='save') {
        show('progressbar_infinite');
        getObject('btn_submit').disabled = true;
        getaddon('/@settings','ssoaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            hide('progressbar_infinite');
            getObject('btn_submit').disabled = false;
            if(r && r.ok) {
                settingsaction('get','users');
                closemodal2();
            }
        });
    }
}
function initAccessCode() {
  const inputs = document.querySelectorAll('.code-input-grid input');
  inputs.forEach((input, index) => {
    // Handle character input and jump to next input
    input.addEventListener('input', (e) => {
      if (input.value.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
      checkAllFilled();
    });
    // Handle backspace and jump to previous input
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Backspace' && input.value === '' && index > 0) {
        inputs[index - 1].focus();
      }
      checkAllFilled();
    });

    // Handle paste event to spread characters across fields
    input.addEventListener('paste', (e) => {
      e.preventDefault(); // Prevent default paste behavior
      const pasteData = e.clipboardData.getData('text').slice(0, inputs.length);

      // Distribute characters across input fields
      inputs.forEach((input, i) => {
        input.value = pasteData[i] || '';
      });

      // Focus the next empty input field after pasting
      const nextEmpty = Array.from(inputs).find((el) => el.value === '');
      if (nextEmpty) nextEmpty.focus();
      checkAllFilled();
    });
  });
}
function checkAllFilled() {
    const inputs = document.querySelectorAll('.code-input-grid input');
    const allFilled = Array.from(inputs).every(input => input.value.length === 1);
    if(allFilled) {
        getObject('btn_check_access_code').click();
    }
}
/*
function presignup(form) {
    show('progressbar1');
    getObject('btn_submit1').disabled = true;    
    getaddon('/@signup','dopresignup=1'+wrapformdata(form),'spacerdiv',function(status) {
        getObject('btn_submit1').disabled = false;
        hide('progressbar1');
        if(callbackerror(status)) return;
        if(status=='ALREADY_LOGGED_IN') {
            document.location.href = '/account/settings';
            return;
        }
        if(status=='EMAIL') {
            myconfirm.open("Please use your work email","To keep AdValify free, the number of scans per user has to be limited in some way. Public email addresses from a free provider are not accepted - it's just too simple to create new ones.<br><br>Please use your company's email address. It will ONLY be used to send your access code. You will NOT end up on a mailing list.<br><br>Are you not working for a company? Then you can't sign up unfortunately.",null,530);
            return;
        }
        var tmp = status.split('#');
        if(tmp[0]!='OK') {
            myconfirm.open("That didn't work",status);
            return;
        }
        
        getObject('div_signup_step1').classList.add('fadeOutLeft');
        setTimeout(function(){
            hide('div_signup_step1');
            show('div_signup_step2');
            hide('h1_signup_step1');
            show('h1_signup_step2');
        },300);
    });
} 
function dosignup(form) {
    show('progressbar2');
    getObject('btn_submit2').disabled = true;
    getaddon('/@signup','dosignup=1'+wrapformdata(form),'spacerdiv',function(status) {
        getObject('btn_submit2').disabled = false;
        hide('progressbar2');
        if(callbackerror(status)) return;
        if(status=='ALREADY_LOGGED_IN') {
            document.location.href = '/account/settings';
            return;
        }
        if(status!='OK') {
            myconfirm.open("That didn't work",status);
            return;
        }
        localStorage.setItem('em',btoa(getObject('advalify_email').value));
        localStorage.setItem('has_account','yes');
        document.location.href = '/account/api-keys';
    });
}
*/
function setFocus(id,n) {
    //places cursor at the end of the text
    var n = n || 0;
    if(n>20) return;
    var obj = (typeof id == 'object') ? id : getObject(id);
    if(!obj) return;
    obj.focus();
    if(obj.getAttribute('contenteditable')) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(obj);
        range.collapse(false); // Set the cursor to the end (false indicates end)
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        var v = obj.value;
        obj.value = '';
        obj.value = v;
    }
    obj.scrollLeft = obj.scrollWidth;
    setTimeout(function(){
        if(obj !== document.activeElement) {
            setTimeout(function(){ setFocus(id,n++); },50);
        }
    },10);
}
function logshare(job_id) {
    getaddon('/@settings','logshare=1&job_id='+job_id,'spacerdiv');
}
function intakeaction() {
    showmodal2(0,600);
    getaddon('/@settings','intakeaction=1','showdiv_modal2',function(){
        
    });
}
function activityaction(action,data,meta) {
    showmodal2(0,700);
    getaddon('/@settings','activityaction=1&folder_id='+data,'showdiv_modal2',function(){
        
    });
}
function openfeedback() {
    showmodal2(460,500,1,1,1);
    getaddon('/@settings','openfeedback=1&uri='+document.location.pathname,'showdiv_modal2',function(){
        getObject('msg').focus();
    });
}
function sendfeedback(form) {
    getaddon('/@settings','sendfeedback=1'+wrapformdata(form),'spacerdiv',function(status) {
        closemodal2();
        myconfirm.open('Received',"Thanks a lot for your time! Your suggestion has been received. Feel free to <a href='/contact'>reach out</a> if you wish to discuss this further.");
    });
}
function setToolMenu(obj,w) {
    myEach('tool_menu',function(){
        this.classList.remove('tool_menu_on');
    });
    obj.classList.add('tool_menu_on');
    hide('menu_tool_zip');
    hide('menu_tool_tag');
    hide('menu_tool_vast');
    show('menu_tool_'+w);
    getObject('menu_tool_scroller').scrollTop = 0;
}

function referralaction(action,data,meta) {
    if(action=='get') {
        showmodal2(500,800);
        getaddon('/@settings','referralaction=1&action='+action,'showdiv_modal2',function(r){
        });
    }
}
function adspecsaction(action,data,meta) {
    if(action=='get') {
        showmodal2(420,600);
        getaddon('/@settings','adspecsaction=1&action='+action+'&project_id='+data+'&creative_type='+(meta||''),'showdiv_modal2',function(r){
            setFocus(document.querySelector('#showdiv_modal2 .search'));
            if(r.scroll_id && getObject(r.scroll_id)) { 
                getObject(r.scroll_id).parentElement.scrollIntoView({
                    behavior: 'auto',
                    block: 'center'
                });
            }
        });
    } else if(action=='set') {
        show('progressbar_infinite');
        getObject('btn_submit').disabled = true;
        getaddon('/@settings','adspecsaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                if(r.job_id) scanaction('get',r.job_id);
                if(r.ad_spec_name) getObject('div_ad_spec_name').innerHTML = foolproof(r.ad_spec_name);
            }
        });
    } else if(action=='favorite') {
        getaddon('/@settings','adspecsaction=1&action='+action+'&spec_id='+data,'spacerdiv',function(r){
        });
    }
}
function transcribeaction(action,data,meta) {
    if(action=='get') {
        showmodal2(380,420);
        getaddon('/@settings','transcribeaction=1&action='+action+'&job_id='+data,'showdiv_modal2',function(r){
        });
    } else if(action=='transcribe') {
        show('progressbar_infinite');
        getObject('btn_submit').disabled = true;
        getaddon('/@settings','transcribeaction=1&action='+action+wrapformdata(data)+'&i='+getI(),'spacerdiv',function(r) {
            hide('progressbar_infinite');
            getObject('btn_submit').disabled = false;
            if(r && r.ok) {
                if(r.require_signup) {
                    loginaction('get','transcribe');
                    return;
                }
                scanaction('get',r.job_id);
                closemodal2();
            }
        });
    }
}
function rescan(action,data,meta) {
    if(action=='get') {
        showmodal2(350);
        getaddon('/@settings','rescan=1&action='+action+'&project_id='+data,'showdiv_modal2',function(r) {
            getaddon('/@settings','rescan=1&action=rescan&project_id='+data,'spacerdiv_rescan',function(r){
                if(r && r.ok) {
                    closemodal2();
                    scanaction('get',r.job_id);
                }
            });
        });
    }
}
function fixaction(action,data,meta,meta2) {
    if(action=='get') {
        showmodal2(380,420);
        getaddon('/@settings','fixaction=1&action='+action+'&data='+data+'&job_id='+meta+'&project_id='+meta2,'showdiv_modal2',function(r){
        });
    } else if(action=='fix') {
        show('progressbar_infinite');
        getObject('btn_submit').disabled = true;
        getaddon('/@settings','fixaction=1&action='+action+wrapformdata(data)+'&i='+getI(),'spacerdiv',function(r) {
            if(getObject('results')) {
                hide('progressbar_infinite');
                getObject('btn_submit').disabled = false;
                if(r && r.ok) {
                    if(r.require_signup) {
                        loginaction('get','fix');
                        return;
                    }
                    myconfirm.open(r.title,r.message);
                    scanaction('get',r.job_id);
                    closemodal2();
                }
            }
        });
    }
}
/*
function reviewaction123(action,data,meta) {
    if(action=='get') {
        showmodal2(660);
        getaddon('/@settings','reviewaction=1&action='+action+'&creative_type='+data+'&job_id='+meta,'showdiv_modal2',function(r){
            setFocus('email');
        });
    } else if(action=='send') {
        getaddon('/@settings','reviewaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                myconfirm.open('<span class=green>Email Sent</span>',"Your email to request a review has been sent.");
            }
        });
    }
}
*/
function commentaction(action,data,meta) {
    if(action=='get') {
        showmodal2(0,800);
        getaddon('/@settings','commentaction=1&action='+action+'&project_id='+data,'showdiv_modal2',function(r){
            getObject('div_comments_scroll').scrollTop = getObject('div_comments_scroll').scrollHeight;
            setFocus('comment_text');
        });
    } else if(action=='add') {
        getaddon('/@settings','commentaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r && r.ok) {
                commentaction('get',r.project_id);
                if(getObject('div_comments_count')) {
                    show('div_comments_count');
                    getObject('div_comments_count').classList.remove('bgdarkgray');
                    getObject('div_comments_count').classList.add('bgdarkblue');
                    getObject('div_comments_count').innerHTML = r.comment_count;
                }
            }
        });
    }
}

function workspaceaction(action,data,meta) {
    if(action=='switch') {
        showmodal1(0,500);
        getaddon('/@settings','workspaceaction=1&action='+action,'showdiv_modal1',function(r){
            if(r && r.ok) {
                if(r.require_signup) {
                    closemodal2();
                    loginaction('get','add_workspace');
                    return;
                }
                setFocus(document.querySelector('#showdiv_modal1 .search'));
                if(r.scroll_id) { 
                    getObject(r.scroll_id).parentElement.scrollIntoView({
                        behavior: 'auto',
                        block: 'center'
                    });
                }
            }
        });
    } else if(action=='favorite') {
        getaddon('/@settings','workspaceaction=1&action='+action+'&workspace_id='+data,'spacerdiv',function(r){
        });
    } else if(action=='set') {
        getaddon('/@settings','workspaceaction=1&action='+action+'&workspace_id='+data,'spacerdiv',function(r){
            closemodal1();
            scanaction('list');
        });
    } else if(action=='get') {
        showmodal2(500,600);
        getaddon('/@settings','workspaceaction=1&action='+action+'&workspace_id='+data,'showdiv_modal2',function(r){
        });
    } else if(action=='get_add') {
        showmodal2(400);
        getaddon('/@settings','workspaceaction=1&action='+action,'showdiv_modal2',function(r) {
            if(r && r.ok) {
                if(r.require_signup) {
                    closemodal2();
                    loginaction('get','add_workspace');
                    return;
                }
                setFocus('name');
            }
        });
    } else if(action=='do_add') {
        getaddon('/@settings','workspaceaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                settingsaction('get','workspaces');
                workspaceaction('get',r.workspace_id);
                scanaction('list');
            }
        });
    } else if(action=='save') {
        getaddon('/@settings','workspaceaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            closemodal2();
            settingsaction('get','workspaces');
            scanaction('list');
        });
    } else if(action=='delete') {
        getaddon('/@settings','workspaceaction=1&action='+action+'&workspace_id='+data,'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                settingsaction('get','workspaces');
                scanaction('list');
                mynotification.open('Workspace removed.');
            }
        });
    }
}
function folderaction(action,data,meta) {
    if(action=='get') {
        showmodal2(400);
        getaddon('/@settings','folderaction=1&action='+action+'&folder_id='+data,'showdiv_modal2',function(r){
            if(r.require_signup) {
                closemodal2();
                loginaction('get','add_folder');
                return;
            }
            setFocus('name');
        });
    } else if(action=='get_add') {
        showmodal2(400);
        getaddon('/@settings','folderaction=1&action='+action+'&parent_id='+(data||0),'showdiv_modal2',function(r) {
            if(r && r.ok) {
                if(r.require_signup) {
                    closemodal2();
                    loginaction('get','add_folder');
                    return;
                }
                setFocus('name');
            }
        });
    } else if(action=='do_add') {
        getaddon('/@settings','folderaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                localStorage.setItem('folder_id',r.folder_id);
                scanaction('list');
            }
        });
    } else if(action=='save') {
        getaddon('/@settings','folderaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            closemodal2();
            scanaction('list');
        });
    } else if(action=='delete') {
        getaddon('/@settings','folderaction=1&action='+action+'&folder_id='+data,'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                if(data == localStorage.getItem('folder_id')) localStorage.setItem('folder_id',-1);
                scanaction('list');
                mynotification.open('Folder removed.');
            }
        });
    } else if(action=='move') {
        showmodal2(0,600);
        getaddon('/@settings','folderaction=1&action='+action+'&folder_id='+localStorage.getItem('folder_id'),'showdiv_modal2',function(r){
                if(r.require_signup) {
                closemodal2();
                loginaction('get','add_folder');
                return;
            }
        });
    }
}
function campaignaction(action,data,meta) {
    if(action=='get') {
        showmodal2(400);
        getaddon('/@settings','campaignaction=1&action='+action+'&campaign_id='+data,'showdiv_modal2',function(r){
            setFocus('name');
        });
    } else if(action=='get_add') {
        showmodal2(400);
        getaddon('/@settings','campaignaction=1&action='+action,'showdiv_modal2',function(r) {
            if(r && r.ok) {
                if(r.require_signup) {
                    closemodal2();
                    loginaction('get','add_campaign');
                    return;
                }
                setFocus('name');
            }
        });
    } else if(action=='do_add') {
        getaddon('/@settings','campaignaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                localStorage.setItem('campaign_id',r.campaign_id);
                scanaction('list');
            }
        });
    } else if(action=='save') {
        getaddon('/@settings','campaignaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            closemodal2();
            localStorage.setItem('campaign_id',r.campaign_id);
            scanaction('list');
        });
    } else if(action=='delete') {
        getaddon('/@settings','campaignaction=1&action='+action+'&campaign_id='+data,'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                if(data == localStorage.getItem('campaign_id')) localStorage.setItem('campaign_id',-1);
                scanaction('list');
                mynotification.open('Campaign removed.');
            }
        });
    }
}
function lockaction(data) {
    getaddon('/@settings','lockaction=1&project_id='+data,'spacerdiv',function(r){
        if(r && r.ok) {
            mynotification.open(r.text);
            scanaction('get',r.job_id);
        }
    });
}
function auditaction(action,data,meta) {
    if(action=='get') {
        showmodal2(700);
        getaddon('/@settings','auditaction=1&action='+action+'&audit_id='+data,'showdiv_modal2',function(r){
        });
    }
}
function feedbackaction(action,data,meta) {
    if(action=='get') {
        showmodal2(500,500);
        getaddon('/@settings','feedbackaction=1&action='+action+'&job_id='+data,'showdiv_modal2',function(r){
            setFocus('message');
        });
    } else if(action=='send') {
        getaddon('/@settings','feedbackaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                mynotification.open('Thanks, I appreciate your time!');
            }
        });
    }
}
function forwardaction(action,data,meta) {
    if(action=='get') {
        showmodal2(0,700);
        getaddon('/@settings','forwardaction=1&action='+action+'&job_id='+data,'showdiv_modal2',function(r){
            setFocus('email');
        });
    } else if(action=='send') {
        getaddon('/@settings','forwardaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r) {
            if(r && r.ok) {
                closemodal2();
                mynotification.open('Report shared');
            }
        });
    }
}
function alertsaction(action,data,meta) {
    if(action=='get') {
        showmodal2(0,700);
        getaddon('/@settings','alertsaction=1&action='+action,'showdiv_modal2',function(r){
        });
    }
}
function approveaction(action,data,meta) {
    if(action=='approve' || action=='undo') {
        getaddon('/@settings','approveaction=1&action='+action+'&folder_id='+data,'showdiv_modal2',function(r){
            if(r && r.require_signup) {
                loginaction('get','approve');
                return;
            }
            if(r && r.ok) scanaction('get');
        });
    }
}
function receivedaction(action,data,meta) {
    if(action=='get') {
        showmodal2(1000);
        getaddon('/@settings','receivedaction=1&action='+action+'&current_job_id='+(window.location.pathname.split('/')[2]||''),'showdiv_modal2',function(r){
        });
    }
}
function useraction(action,data,meta) {
    if(action=='get') {
        showmodal2(600);
        getaddon('/@settings','useraction=1&action='+action+'&account_id='+data,'showdiv_modal2',function(r){
        });
    } else if(action=='save') {
        getaddon('/@settings','useraction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                settingsaction('get','users');
            }
        });
    } else if(action=='delete') {
        getaddon('/@settings','useraction=1&action='+action+'&account_id='+data,'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                settingsaction('get','users');
            }
        });
    }
}
function statusaction(action,data,meta) {
    if(action=='get') {
        showmodal2(600,220);
        getaddon('/@settings','statusaction=1&action='+action+'&project_id='+data+'&key='+meta,'showdiv_modal2',function(r){
        });
    } else if(action=='save') {
        getaddon('/@settings','statusaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                scanaction('get',r.job_id);
                if(r.new_status==2) confetti();
            }
        });
    }
}
function settingsaction(action,data,meta) {
    if(action=='get') {
        showmodal1(1010);
        getaddon('/@settings','settingsaction=1&action='+action+'&tab='+(data||'')+'&interest='+(meta||''),'showdiv_modal1',function(r){
            if(meta) {
                setTimeout(function(){
                    const container = document.querySelector('.settings_content');
                    const targetElement = document.getElementById('div_enterprise_'+meta);
                    container.scrollTo({
                        top: targetElement.offsetTop - container.offsetTop,
                        behavior: 'smooth'
                    });
                },200);
            }
            if(r && r.require_signup) {
                closemodal1();
                loginaction('get','settings');
                return;
            }
        });
    } else if(action=='save') {
        getaddon('/@settings','settingsaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r && r.ok) {
                mynotification.open('Saved');
            }
        });
    }
}
function scansleftaction(action,data,meta) {
    if(action=='get') {
        getaddon('/@settings','scansleftaction=1&action='+action+'&i='+getI(),'spacerdiv',function(r){
            if(r && r.ok) getObject('div_scans_left').innerHTML = r.html;
        });
    }
}

function getsharelink(creative_type,job_id) {
    showmodal2(650,250);
    getaddon('/@settings','getsharelink=1&creative_type='+creative_type+'&job_id='+job_id,'showdiv_modal2');
}
function getinvitecolleague(creative_type,job_id) {
    showmodal2(650,250);
    getaddon('/@settings','getinvitecolleague=1&creative_type='+creative_type+'&job_id='+job_id,'showdiv_modal2');
}

function docready_things() {
    //stop submitting forms on enter
    var inputs = document.getElementsByTagName('input');
    for(var i=0; i<inputs.length; i++) {
        inputs[i].addEventListener('keydown',function(e){
            if(e.keyCode==13) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        inputs[i].setAttribute('spellcheck',false);
        inputs[i].setAttribute('autocapitalize',false);
        inputs[i].setAttribute('autocorrect',false);
        inputs[i].setAttribute('autocomplete','off');
    }
    var forms = document.getElementsByTagName('form');
    for(var i=0; i<forms.length; i++) {
        forms[i].onsubmit = function(){return false;}
    }
    var buttons = document.getElementsByTagName('button');
    for(var i=0; i<buttons.length; i++) {
        buttons[i].type = 'button';
    }
}
document.addEventListener('DOMContentLoaded', function(){ docready_things(); }, false);

function trim(value) {
    value = value.replace(/^\s+/,''); 
    value = value.replace(/\s+$/,'');
    return value;
}

function textareaAutoHeight(obj) {
    if(!obj) return;
    obj.style.height = '30px';
    var h = parseInt(obj.scrollHeight) || 30;
    console.log(h);
    obj.style.height = h+'px';
}
function worldmap(id,classname) {
    var id = id || 'map';
      if(!getObject(id)) return;
    var locations = JSON.parse(getObject(id+'_coords').innerHTML||{});
    var classname = classname || 'pulsar';
    var div = document.getElementById(id);
    var width = 1000;
    
    var scale=width/887;
    var height=width*.62;
    
    //create locations
    for(var location in locations) {
        var loc = locations[location];
        var xy = get_xy(loc.lat, loc.lng);   
        var i = document.createElement('div');
        i.className = classname;
        i.style.position = 'absolute';
        i.style.left = (xy.x * scale)+'px';
        i.style.top = (xy.y * scale)+'px';
        i.style.width = (loc.weight * 40)+'px';
        i.style.height = (loc.weight * 40)+'px';
        i.style.opacity = 0.95; //(loc.weight * 0.6) + 0.2;
        if(loc.country) {
            i.setAttribute('data-tippy',loc.country);
            i.setAttribute('data-tippy-pos','up');
            i.setAttribute('data-tippy-size','jumbo');
            i.setAttribute('data-tippy-animate','slide');
        }
        document.getElementById('map').appendChild(i);
    }
    
    function get_xy(lat,lng) {
        var mapWidth=2058;
        var mapHeight=1746;
        var factor=.404;
        var x_adj=-391;
        var y_adj=37;
        var x = (mapWidth*(180+lng)/360)%mapWidth+(mapWidth/2);
        
        //convert from degrees to radians
        var latRad = lat*Math.PI/180;
        
        //get y value
        var mercN = Math.log(Math.tan((Math.PI/4)+(latRad/2)));
        var y = (mapHeight/2)-(mapWidth*mercN/(2*Math.PI));
        return { x: x*factor+x_adj, y: y*factor+y_adj}
    }		
}
function chatAvailable() {
    try {
        if(window.Tawk_API.isChatHidden()==false) return true;
        return false;
    } catch(e) {
        return false;
    }
}

//party.min.js (https://www.cssscript.com/confetti-animation-party/)
!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define("party",[],t):"object"==typeof exports?exports.party=t():e.party=t()}(self,(function(){return(()=>{"use strict";var e={"./src/components/circle.ts":(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Circle=void 0;var r=function(){function e(e,t,r){void 0===r&&(r=0),this.x=e,this.y=t,this.radius=r}return e.zero=new e(0,0),e}();t.Circle=r},"./src/components/color.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Color=void 0;var i=r("./src/systems/math.ts"),n=function(){function e(e,t,r){this.values=new Float32Array(3),this.rgb=[e,t,r]}return Object.defineProperty(e.prototype,"r",{get:function(){return this.values[0]},set:function(e){this.values[0]=Math.floor(e)},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"g",{get:function(){return this.values[1]},set:function(e){this.values[1]=Math.floor(e)},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"b",{get:function(){return this.values[2]},set:function(e){this.values[2]=Math.floor(e)},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"rgb",{get:function(){return[this.r,this.g,this.b]},set:function(e){this.r=e[0],this.g=e[1],this.b=e[2]},enumerable:!1,configurable:!0}),e.prototype.mix=function(t,r){return void 0===r&&(r=.5),new e(i.lerp(this.r,t.r,r),i.lerp(this.g,t.g,r),i.lerp(this.b,t.b,r))},e.prototype.toHex=function(){var e=function(e){return e.toString(16).padStart(2,"0")};return"#"+e(this.r)+e(this.g)+e(this.b)},e.prototype.toString=function(){return"rgb("+this.values.join(", ")+")"},e.fromHex=function(t){return t.startsWith("#")&&(t=t.substr(1)),new e(parseInt(t.substr(0,2),16),parseInt(t.substr(2,2),16),parseInt(t.substr(4,2),16))},e.fromHsl=function(t,r,i){if(t/=360,i/=100,0===(r/=100))return new e(i,i,i);var n=function(e,t,r){return r<0&&(r+=1),r>1&&(r-=1),r<1/6?e+6*(t-e)*r:r<.5?t:r<2/3?e+(t-e)*(2/3-r)*6:e},o=function(e){return Math.min(255,256*e)},s=i<.5?i*(1+r):i+r-i*r,a=2*i-s;return new e(o(n(a,s,t+1/3)),o(n(a,s,t)),o(n(a,s,t-1/3)))},e.white=new e(255,255,255),e.black=new e(0,0,0),e}();t.Color=n},"./src/components/gradient.ts":function(e,t,r){var i,n=this&&this.__extends||(i=function(e,t){return(i=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(e[r]=t[r])})(e,t)},function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Class extends value "+String(t)+" is not a constructor or null");function r(){this.constructor=e}i(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=this&&this.__spreadArray||function(e,t){for(var r=0,i=t.length,n=e.length;r<i;r++,n++)e[n]=t[r];return e};Object.defineProperty(t,"__esModule",{value:!0}),t.Gradient=void 0;var s=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return n(t,e),t.prototype.interpolate=function(e,t,r){return e.mix(t,r)},t.solid=function(e){return new t({value:e,time:.5})},t.simple=function(){for(var e=[],r=0;r<arguments.length;r++)e[r]=arguments[r];var i=1/(e.length-1);return new(t.bind.apply(t,o([void 0],e.map((function(e,t){return{value:e,time:t*i}})))))},t}(r("./src/components/spline.ts").Spline);t.Gradient=s},"./src/components/index.ts":function(e,t,r){var i=this&&this.__createBinding||(Object.create?function(e,t,r,i){void 0===i&&(i=r),Object.defineProperty(e,i,{enumerable:!0,get:function(){return t[r]}})}:function(e,t,r,i){void 0===i&&(i=r),e[i]=t[r]}),n=this&&this.__exportStar||function(e,t){for(var r in e)"default"===r||Object.prototype.hasOwnProperty.call(t,r)||i(t,e,r)};Object.defineProperty(t,"__esModule",{value:!0}),n(r("./src/components/circle.ts"),t),n(r("./src/components/color.ts"),t),n(r("./src/components/gradient.ts"),t),n(r("./src/components/numericSpline.ts"),t),n(r("./src/components/rect.ts"),t),n(r("./src/components/vector.ts"),t)},"./src/components/numericSpline.ts":function(e,t,r){var i,n=this&&this.__extends||(i=function(e,t){return(i=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(e[r]=t[r])})(e,t)},function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Class extends value "+String(t)+" is not a constructor or null");function r(){this.constructor=e}i(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)});Object.defineProperty(t,"__esModule",{value:!0}),t.NumericSpline=void 0;var o=r("./src/systems/math.ts"),s=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return n(t,e),t.prototype.interpolate=function(e,t,r){return o.slerp(e,t,r)},t}(r("./src/components/spline.ts").Spline);t.NumericSpline=s},"./src/components/rect.ts":(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Rect=void 0;var r=function(){function e(e,t,r,i){void 0===r&&(r=0),void 0===i&&(i=0),this.x=e,this.y=t,this.width=r,this.height=i}return e.fromScreen=function(){return new e(window.scrollX,window.scrollY,window.innerWidth,window.innerHeight)},e.fromElement=function(t){var r=t.getBoundingClientRect();return new e(window.scrollX+r.x,window.scrollY+r.y,r.width,r.height)},e.zero=new e(0,0),e}();t.Rect=r},"./src/components/spline.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Spline=void 0;var i=r("./src/systems/math.ts"),n=function(){function e(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];if(0===e.length)throw new Error("Splines require at least one key.");if(Array.isArray(e[0]))throw new Error("You are trying to pass an array to the spline constructor, which is not supported. Try to spread the array into the constructor instead.");this.keys=e}return e.prototype.evaluate=function(e){if(0===this.keys.length)throw new Error("Attempt to evaluate a spline with no keys.");if(1===this.keys.length)return this.keys[0].value;var t=this.keys.sort((function(e,t){return e.time-t.time})),r=t.findIndex((function(t){return t.time>e}));if(0===r)return t[0].value;if(-1===r)return t[t.length-1].value;var n=t[r-1],o=t[r],s=i.invlerp(n.time,o.time,e);return this.interpolate(n.value,o.value,s)},e}();t.Spline=n},"./src/components/vector.ts":function(e,t,r){var i=this&&this.__spreadArray||function(e,t){for(var r=0,i=t.length,n=e.length;r<i;r++,n++)e[n]=t[r];return e};Object.defineProperty(t,"__esModule",{value:!0}),t.Vector=void 0;var n=r("./src/systems/math.ts"),o=function(){function e(e,t,r){void 0===e&&(e=0),void 0===t&&(t=0),void 0===r&&(r=0),this.values=new Float32Array(3),this.xyz=[e,t,r]}return Object.defineProperty(e.prototype,"x",{get:function(){return this.values[0]},set:function(e){this.values[0]=e},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"y",{get:function(){return this.values[1]},set:function(e){this.values[1]=e},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"z",{get:function(){return this.values[2]},set:function(e){this.values[2]=e},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"xyz",{get:function(){return[this.x,this.y,this.z]},set:function(e){this.values[0]=e[0],this.values[1]=e[1],this.values[2]=e[2]},enumerable:!1,configurable:!0}),e.prototype.magnitude=function(){return Math.sqrt(this.sqrMagnitude())},e.prototype.sqrMagnitude=function(){return this.x*this.x+this.y*this.y+this.z*this.z},e.prototype.add=function(t){return new e(this.x+t.x,this.y+t.y,this.z+t.z)},e.prototype.subtract=function(t){return new e(this.x-t.x,this.y-t.y,this.z-t.z)},e.prototype.scale=function(t){return"number"==typeof t?new e(this.x*t,this.y*t,this.z*t):new e(this.x*t.x,this.y*t.y,this.z*t.z)},e.prototype.normalized=function(){var t=this.magnitude();return 0!==t?this.scale(1/t):new(e.bind.apply(e,i([void 0],this.xyz)))},e.prototype.angle=function(e){return n.rad2deg*Math.acos((this.x*e.x+this.y*e.y+this.z*e.z)/(this.magnitude()*e.magnitude()))},e.prototype.cross=function(t){return new e(this.y*t.z-this.z*t.y,this.z*t.x-this.x*t.z,this.x*t.y-this.y*t.x)},e.prototype.dot=function(e){return this.magnitude()*e.magnitude()*Math.cos(n.deg2rad*this.angle(e))},e.prototype.toString=function(){return"Vector("+this.values.join(", ")+")"},e.from2dAngle=function(t){return new e(Math.cos(t*n.deg2rad),Math.sin(t*n.deg2rad))},e.zero=new e(0,0,0),e.one=new e(1,1,1),e.right=new e(1,0,0),e.up=new e(0,1,0),e.forward=new e(0,0,1),e}();t.Vector=o},"./src/containers.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.particleContainer=t.debugContainer=t.rootContainer=void 0;var i=r("./src/settings.ts"),n=r("./src/util/index.ts");function o(e){return e&&e.isConnected}function s(e,t,r){var i=document.createElement("div");return i.id="party-js-"+e,Object.assign(i.style,t),r.appendChild(i)}t.rootContainer=new n.Lazy((function(){return s("container",{position:"fixed",left:"0",top:"0",height:"100vh",width:"100vw",pointerEvents:"none",userSelect:"none",zIndex:i.settings.zIndex.toString()},document.body)}),o),t.debugContainer=new n.Lazy((function(){return s("debug",{position:"absolute",top:"0",left:"0",margin:"0.5em",padding:"0.5em 1em",border:"2px solid rgb(0, 0, 0, 0.2)",background:"rgb(0, 0, 0, 0.1)",color:"#555",fontFamily:"monospace"},t.rootContainer.current)}),o),t.particleContainer=new n.Lazy((function(){return s("particles",{width:"100%",height:"100%",overflow:"hidden",perspective:"1200px"},t.rootContainer.current)}),o)},"./src/debug.ts":function(e,t,r){var i=this&&this.__spreadArray||function(e,t){for(var r=0,i=t.length,n=e.length;r<i;r++,n++)e[n]=t[r];return e};Object.defineProperty(t,"__esModule",{value:!0}),t.Debug=void 0;var n=r("./src/containers.ts"),o=r("./src/settings.ts"),s=function(){function e(e){this.scene=e,this.refreshRate=8,this.refreshTimer=1/this.refreshRate}return e.prototype.tick=function(e){var t=n.debugContainer.current,r=o.settings.debug?"block":"none";t.style.display!==r&&(t.style.display=r),o.settings.debug&&(this.refreshTimer+=e,this.refreshTimer>1/this.refreshRate&&(this.refreshTimer=0,t.innerHTML=this.getDebugInformation(e).join("<br>")))},e.prototype.getDebugInformation=function(e){var t=this.scene.emitters.length,r=this.scene.emitters.reduce((function(e,t){return e+t.particles.length}),0),n=["<b>party.js Debug</b>","--------------","FPS: "+Math.round(1/e),"Emitters: "+t,"Particles: "+r],o=this.scene.emitters.map((function(e){return["?: "+(e.currentLoop+1)+"/"+(e.options.loops>=0?e.options.loops:"8"),"Sp: "+e.particles.length,e.isExpired?"<i>expired</i>":"St: "+e.durationTimer.toFixed(3)+"s"].join(", ")}));return n.push.apply(n,i(["--------------"],o)),n},e}();t.Debug=s},"./src/index.ts":function(e,t,r){var i=this&&this.__createBinding||(Object.create?function(e,t,r,i){void 0===i&&(i=r),Object.defineProperty(e,i,{enumerable:!0,get:function(){return t[r]}})}:function(e,t,r,i){void 0===i&&(i=r),e[i]=t[r]}),n=this&&this.__exportStar||function(e,t){for(var r in e)"default"===r||Object.prototype.hasOwnProperty.call(t,r)||i(t,e,r)};Object.defineProperty(t,"__esModule",{value:!0}),t.default=t.forceInit=t.util=t.math=t.random=t.sources=t.variation=t.Emitter=t.Particle=t.settings=t.scene=void 0;var o=r("./src/scene.ts"),s=r("./src/util/index.ts");n(r("./src/components/index.ts"),t),n(r("./src/templates/index.ts"),t),n(r("./src/systems/shapes.ts"),t),n(r("./src/systems/modules.ts"),t),t.scene=new s.Lazy((function(){if("undefined"==typeof document||"undefined"==typeof window)throw new Error("It seems like you are trying to run party.js in a non-browser-like environment, which is not supported.");return new o.Scene}));var a=r("./src/settings.ts");Object.defineProperty(t,"settings",{enumerable:!0,get:function(){return a.settings}});var c=r("./src/particles/particle.ts");Object.defineProperty(t,"Particle",{enumerable:!0,get:function(){return c.Particle}});var u=r("./src/particles/emitter.ts");Object.defineProperty(t,"Emitter",{enumerable:!0,get:function(){return u.Emitter}}),t.variation=r("./src/systems/variation.ts"),t.sources=r("./src/systems/sources.ts"),t.random=r("./src/systems/random.ts"),t.math=r("./src/systems/math.ts"),t.util=r("./src/util/index.ts"),t.forceInit=function(){t.scene.current},t.default=r("./src/index.ts")},"./src/particles/emitter.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Emitter=void 0;var i=r("./src/components/vector.ts"),n=r("./src/settings.ts"),o=r("./src/systems/variation.ts"),s=r("./src/util/config.ts"),a=r("./src/particles/options/index.ts"),c=r("./src/particles/particle.ts"),u=function(){function e(e){this.particles=[],this.currentLoop=0,this.durationTimer=0,this.emissionTimer=0,this.attemptedBurstIndices=[],this.options=s.overrideDefaults(a.getDefaultEmitterOptions(),null==e?void 0:e.emitterOptions),this.emission=s.overrideDefaults(a.getDefaultEmissionOptions(),null==e?void 0:e.emissionOptions),this.renderer=s.overrideDefaults(a.getDefaultRendererOptions(),null==e?void 0:e.rendererOptions)}return Object.defineProperty(e.prototype,"isExpired",{get:function(){return this.options.loops>=0&&this.currentLoop>=this.options.loops},enumerable:!1,configurable:!0}),Object.defineProperty(e.prototype,"canRemove",{get:function(){return 0===this.particles.length},enumerable:!1,configurable:!0}),e.prototype.clearParticles=function(){return this.particles.splice(0).length},e.prototype.tick=function(e){if(!this.isExpired&&(this.durationTimer+=e,this.durationTimer>=this.options.duration&&(this.currentLoop++,this.durationTimer=0,this.attemptedBurstIndices=[]),!this.isExpired)){for(var t=0,r=0,i=this.emission.bursts;r<i.length;r++){var n=i[r];if(n.time<=this.durationTimer&&!this.attemptedBurstIndices.includes(t)){for(var s=o.evaluateVariation(n.count),a=0;a<s;a++)this.emitParticle();this.attemptedBurstIndices.push(t)}t++}this.emissionTimer+=e;for(var c=1/this.emission.rate;this.emissionTimer>c;)this.emissionTimer-=c,this.emitParticle()}var u=function(t){var r=l.particles[t];l.tickParticle(r,e),l.options.despawningRules.some((function(e){return e(r)}))&&l.particles.splice(t,1)},l=this;for(a=this.particles.length-1;a>=0;a--)u(a)},e.prototype.tickParticle=function(e,t){e.lifetime-=t,this.options.useGravity&&(e.velocity=e.velocity.add(i.Vector.up.scale(n.settings.gravity*t))),e.location=e.location.add(e.velocity.scale(t));for(var r=0,o=this.options.modules;r<o.length;r++){(0,o[r])(e)}},e.prototype.emitParticle=function(){var e=new c.Particle({location:this.emission.sourceSampler(),lifetime:o.evaluateVariation(this.emission.initialLifetime),velocity:i.Vector.from2dAngle(o.evaluateVariation(this.emission.angle)).scale(o.evaluateVariation(this.emission.initialSpeed)),size:o.evaluateVariation(this.emission.initialSize),rotation:o.evaluateVariation(this.emission.initialRotation),color:o.evaluateVariation(this.emission.initialColor)});return this.particles.push(e),this.particles.length>this.options.maxParticles&&this.particles.shift(),e},e}();t.Emitter=u},"./src/particles/options/emissionOptions.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.getDefaultEmissionOptions=void 0;var i=r("./src/components/index.ts"),n=r("./src/systems/sources.ts");t.getDefaultEmissionOptions=function(){return{rate:10,angle:0,bursts:[],sourceSampler:n.rectSource(i.Rect.zero),initialLifetime:5,initialSpeed:5,initialSize:1,initialRotation:i.Vector.zero,initialColor:i.Color.white}}},"./src/particles/options/emitterOptions.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.getDefaultEmitterOptions=void 0;var i=r("./src/util/rules.ts");t.getDefaultEmitterOptions=function(){return{duration:5,loops:1,useGravity:!0,maxParticles:300,despawningRules:[i.despawningRules.lifetime,i.despawningRules.bounds],modules:[]}}},"./src/particles/options/index.ts":function(e,t,r){var i=this&&this.__createBinding||(Object.create?function(e,t,r,i){void 0===i&&(i=r),Object.defineProperty(e,i,{enumerable:!0,get:function(){return t[r]}})}:function(e,t,r,i){void 0===i&&(i=r),e[i]=t[r]}),n=this&&this.__exportStar||function(e,t){for(var r in e)"default"===r||Object.prototype.hasOwnProperty.call(t,r)||i(t,e,r)};Object.defineProperty(t,"__esModule",{value:!0}),n(r("./src/particles/options/emitterOptions.ts"),t),n(r("./src/particles/options/emissionOptions.ts"),t),n(r("./src/particles/options/renderOptions.ts"),t)},"./src/particles/options/renderOptions.ts":(e,t)=>{function r(e,t){var r=e.toHex();switch(t.nodeName.toLowerCase()){case"div":t.style.background=r;break;case"svg":t.style.fill=t.style.color=r;break;default:t.style.color=r}}function i(e,t){t.style.opacity=e.toString()}function n(e,t){t.style.filter="brightness("+(.5+Math.abs(e))+")"}function o(e,t){t.style.transform="translateX("+(e.location.x-window.scrollX).toFixed(3)+"px) translateY("+(e.location.y-window.scrollY).toFixed(3)+"px) translateZ("+e.location.z.toFixed(3)+"px) rotateX("+e.rotation.x.toFixed(3)+"deg) rotateY("+e.rotation.y.toFixed(3)+"deg) rotateZ("+e.rotation.z.toFixed(3)+"deg) scale("+e.size.toFixed(3)+")"}Object.defineProperty(t,"__esModule",{value:!0}),t.getDefaultRendererOptions=void 0,t.getDefaultRendererOptions=function(){return{shapeFactory:"square",applyColor:r,applyOpacity:i,applyLighting:n,applyTransform:o}}},"./src/particles/particle.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Particle=void 0;var i=r("./src/components/index.ts"),n=r("./src/util/config.ts"),o=function(e){var t=n.overrideDefaults({lifetime:0,size:1,location:i.Vector.zero,rotation:i.Vector.zero,velocity:i.Vector.zero,color:i.Color.white,opacity:1},e);this.id=Symbol(),this.size=this.initialSize=t.size,this.lifetime=this.initialLifetime=t.lifetime,this.rotation=this.initialRotation=t.rotation,this.location=t.location,this.velocity=t.velocity,this.color=t.color,this.opacity=t.opacity};t.Particle=o},"./src/particles/renderer.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Renderer=void 0;var i=r("./src/index.ts"),n=r("./src/components/vector.ts"),o=r("./src/containers.ts"),s=r("./src/systems/shapes.ts"),a=r("./src/util/index.ts"),c=function(){function e(){this.elements=new Map,this.light=new n.Vector(0,0,1),this.enabled=!0,this.enabled=!i.settings.respectReducedMotion||!window.matchMedia("(prefers-reduced-motion)").matches}return e.prototype.begin=function(){this.renderedParticles=[]},e.prototype.end=function(){for(var e=this.elements.keys(),t=e.next();!t.done;){var r=t.value;this.renderedParticles.includes(r)||(this.elements.get(r).remove(),this.elements.delete(r)),t=e.next()}return this.renderedParticles.length},e.prototype.renderParticle=function(e,t){if(this.enabled){var r=t.renderer,i=this.elements.has(e.id)?this.elements.get(e.id):this.createParticleElement(e,r);if(r.applyColor&&r.applyColor(e.color,i),r.applyOpacity&&r.applyOpacity(e.opacity,i),r.applyLighting){var n=a.rotationToNormal(e.rotation).dot(this.light);r.applyLighting(n,i)}r.applyTransform&&r.applyTransform(e,i),this.renderedParticles.push(e.id)}},e.prototype.createParticleElement=function(e,t){var r=s.resolveShapeFactory(t.shapeFactory).cloneNode(!0);return r.style.position="absolute",this.elements.set(e.id,o.particleContainer.current.appendChild(r)),r},e}();t.Renderer=c},"./src/scene.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Scene=void 0;var i=r("./src/debug.ts"),n=r("./src/particles/emitter.ts"),o=r("./src/particles/renderer.ts"),s=function(){function e(){this.emitters=[],this.debug=new i.Debug(this),this.renderer=new o.Renderer,this.scheduledTickId=void 0,this.lastTickTimestamp=performance.now(),this.tick=this.tick.bind(this),this.scheduleTick()}return e.prototype.createEmitter=function(e){var t=new n.Emitter(e);return this.emitters.push(t),t},e.prototype.clearEmitters=function(){return this.emitters.splice(0).length},e.prototype.clearParticles=function(){return this.emitters.reduce((function(e,t){return e+t.clearParticles()}),0)},e.prototype.scheduleTick=function(){this.scheduledTickId=window.requestAnimationFrame(this.tick)},e.prototype.cancelTick=function(){window.cancelAnimationFrame(this.scheduledTickId)},e.prototype.tick=function(e){var t=(e-this.lastTickTimestamp)/1e3;try{for(var r=0;r<this.emitters.length;r++){(o=this.emitters[r]).tick(t),o.isExpired&&o.canRemove&&this.emitters.splice(r--,1)}}catch(e){console.error("An error occurred while updating the scene's emitters:\n\""+e+'"')}try{this.renderer.begin();for(var i=0,n=this.emitters;i<n.length;i++)for(var o=n[i],s=0,a=o.particles;s<a.length;s++){var c=a[s];this.renderer.renderParticle(c,o)}this.renderer.end()}catch(e){console.error("An error occurred while rendering the scene's particles:\n\""+e+'"')}this.debug.tick(t),this.lastTickTimestamp=e,this.scheduleTick()},e}();t.Scene=s},"./src/settings.ts":(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.settings=void 0,t.settings={debug:!1,gravity:800,zIndex:2147483642,respectReducedMotion:!0}},"./src/systems/math.ts":(e,t)=>{function r(e,t,r){return(1-r)*e+r*t}Object.defineProperty(t,"__esModule",{value:!0}),t.approximately=t.clamp=t.invlerp=t.slerp=t.lerp=t.epsilon=t.rad2deg=t.deg2rad=void 0,t.deg2rad=Math.PI/180,t.rad2deg=180/Math.PI,t.epsilon=1e-6,t.lerp=r,t.slerp=function(e,t,i){return r(e,t,(1-Math.cos(i*Math.PI))/2)},t.invlerp=function(e,t,r){return(r-e)/(t-e)},t.clamp=function(e,t,r){return Math.min(r,Math.max(t,e))},t.approximately=function(e,r){return Math.abs(e-r)<t.epsilon}},"./src/systems/modules.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.ModuleBuilder=void 0;var i=r("./src/components/index.ts"),n=function(){function e(){this.factor="lifetime",this.isRelative=!1}return e.prototype.drive=function(e){return this.driverKey=e,this},e.prototype.through=function(e){return this.factor=e,this},e.prototype.by=function(e){return this.driverValue=e,this},e.prototype.relative=function(e){return void 0===e&&(e=!0),this.isRelative=e,this},e.prototype.build=function(){var e=this;if(void 0===this.driverKey)throw new Error("No driving key was provided in the module builder. Did you forget a '.drive()' call?");if(void 0===this.driverValue)throw new Error("No driving value was provided in the module builder. Did you forget a '.through()' call?");return function(t){o(t,e.driverKey,function(e,t,r){if("object"==typeof e&&"evaluate"in e)return e.evaluate(t);if("function"==typeof e)return e(t,r);return e}(e.driverValue,function(e,t){switch(e){case"lifetime":return t.initialLifetime-t.lifetime;case"relativeLifetime":return(t.initialLifetime-t.lifetime)/t.initialLifetime;case"size":return t.size;default:throw new Error("Invalid driving factor '"+e+"'.")}}(e.factor,t),t),e.isRelative)}},e}();function o(e,t,r,n){if(void 0===n&&(n=!1),n){var s=e["initial"+t[0].toUpperCase()+t.substr(1)];if(void 0===s)throw new Error("Unable to use relative chaining with key '"+t+"'; no initial value exists.");if(r instanceof i.Vector)o(e,t,s.add(r));else{if("number"!=typeof r)throw new Error("Unable to use relative chaining with particle key '"+t+"'; no relative operation for '"+r+"' could be inferred.");o(e,t,s*r)}}else e[t]=r}t.ModuleBuilder=n},"./src/systems/random.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.randomInsideCircle=t.randomInsideRect=t.randomUnitVector=t.pick=t.randomRange=void 0;var i=r("./src/components/index.ts"),n=r("./src/systems/math.ts");function o(e,t){return void 0===e&&(e=0),void 0===t&&(t=1),n.lerp(e,t,Math.random())}t.randomRange=o,t.pick=function(e){return 0===e.length?void 0:e[Math.floor(Math.random()*e.length)]},t.randomUnitVector=function(){var e=o(0,2*Math.PI),t=o(-1,1);return new i.Vector(Math.sqrt(1-t*t)*Math.cos(e),Math.sqrt(1-t*t)*Math.sin(e),t)},t.randomInsideRect=function(e){return new i.Vector(e.x+o(0,e.width),e.y+o(0,e.height))},t.randomInsideCircle=function(e){var t=o(0,2*Math.PI),r=o(0,e.radius);return new i.Vector(e.x+Math.cos(t)*r,e.y+Math.sin(t)*r)}},"./src/systems/shapes.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.resolveShapeFactory=t.resolvableShapes=void 0;var i=r("./src/systems/variation.ts");t.resolvableShapes={square:'<div style="height: 10px; width: 10px;"></div>',rectangle:'<div style="height: 6px; width: 10px;"></div>',circle:'<svg viewBox="0 0 2 2" width="10" height="10"><circle cx="1" cy="1" r="1" fill="currentColor"/></svg>',roundedSquare:'<div style="height: 10px; width: 10px; border-radius: 3px;"></div>',roundedRectangle:'<div style="height: 6px; width: 10px; border-radius: 3px;"></div>',star:'<svg viewBox="0 0 512 512" width="15" height="15"><polygon fill="currentColor" points="512,197.816 325.961,185.585 255.898,9.569 185.835,185.585 0,197.816 142.534,318.842 95.762,502.431 255.898,401.21 416.035,502.431 369.263,318.842"/></svg>'},t.resolveShapeFactory=function(e){var r=i.evaluateVariation(e);if("string"==typeof r){var n=t.resolvableShapes[r];if(!n)throw new Error("Failed to resolve shape key '"+r+"'. Did you forget to add it to the 'resolvableShapes' lookup?");var o=document.createElement("div");return o.innerHTML=n,o.firstElementChild}return r}},"./src/systems/sources.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.circleSource=t.rectSource=t.mouseSource=t.elementSource=t.dynamicSource=void 0;var i=r("./src/components/index.ts"),n=r("./src/systems/random.ts");function o(e){return function(){return n.randomInsideRect(i.Rect.fromElement(e))}}function s(e){return function(){return new i.Vector(window.scrollX+e.clientX,window.scrollY+e.clientY)}}function a(e){return function(){return n.randomInsideRect(e)}}function c(e){return function(){return n.randomInsideCircle(e)}}t.dynamicSource=function(e){if(e instanceof HTMLElement)return o(e);if(e instanceof i.Circle)return c(e);if(e instanceof i.Rect)return a(e);if(e instanceof MouseEvent)return s(e);throw new Error("Cannot infer the source type of '"+e+"'.")},t.elementSource=o,t.mouseSource=s,t.rectSource=a,t.circleSource=c},"./src/systems/variation.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.gradientSample=t.splineSample=t.skewRelative=t.skew=t.range=t.evaluateVariation=void 0;var i=r("./src/systems/random.ts");function n(e){return function(){return e.evaluate(Math.random())}}t.evaluateVariation=function(e){return Array.isArray(e)?i.pick(e):"function"==typeof e?e():e},t.range=function(e,t){return function(){return i.randomRange(e,t)}},t.skew=function(e,t){return function(){return e+i.randomRange(-t,t)}},t.skewRelative=function(e,t){return function(){return e*(1+i.randomRange(-t,t))}},t.splineSample=n,t.gradientSample=function(e){return n(e)}},"./src/templates/confetti.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.confetti=void 0;var i=r("./src/index.ts"),n=r("./src/components/index.ts"),o=r("./src/systems/modules.ts"),s=r("./src/systems/random.ts"),a=r("./src/systems/sources.ts"),c=r("./src/systems/variation.ts"),u=r("./src/util/index.ts");t.confetti=function(e,t){var r=u.overrideDefaults({count:c.range(20,40),spread:c.range(35,45),speed:c.range(300,600),size:c.skew(1,.2),rotation:function(){return s.randomUnitVector().scale(180)},color:function(){return n.Color.fromHsl(s.randomRange(0,360),100,70)},modules:[(new o.ModuleBuilder).drive("size").by((function(e){return Math.min(1,3*e)})).relative().build(),(new o.ModuleBuilder).drive("rotation").by((function(e){return new n.Vector(140,200,260).scale(e)})).relative().build()],shapes:["square","circle"]},t);return i.scene.current.createEmitter({emitterOptions:{loops:1,duration:8,modules:r.modules},emissionOptions:{rate:0,bursts:[{time:0,count:r.count}],sourceSampler:a.dynamicSource(e),angle:c.skew(-90,c.evaluateVariation(r.spread)),initialLifetime:8,initialSpeed:r.speed,initialSize:r.size,initialRotation:r.rotation,initialColor:r.color},rendererOptions:{shapeFactory:r.shapes}})}},"./src/templates/index.ts":function(e,t,r){var i=this&&this.__createBinding||(Object.create?function(e,t,r,i){void 0===i&&(i=r),Object.defineProperty(e,i,{enumerable:!0,get:function(){return t[r]}})}:function(e,t,r,i){void 0===i&&(i=r),e[i]=t[r]}),n=this&&this.__exportStar||function(e,t){for(var r in e)"default"===r||Object.prototype.hasOwnProperty.call(t,r)||i(t,e,r)};Object.defineProperty(t,"__esModule",{value:!0}),n(r("./src/templates/confetti.ts"),t),n(r("./src/templates/sparkles.ts"),t)},"./src/templates/sparkles.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.sparkles=void 0;var i=r("./src/index.ts"),n=r("./src/components/index.ts"),o=r("./src/systems/modules.ts"),s=r("./src/systems/random.ts"),a=r("./src/systems/sources.ts"),c=r("./src/systems/variation.ts"),u=r("./src/util/index.ts");t.sparkles=function(e,t){var r=u.overrideDefaults({lifetime:c.range(1,2),count:c.range(10,20),speed:c.range(100,200),size:c.range(.8,1.8),rotation:function(){return new n.Vector(0,0,s.randomRange(0,360))},color:function(){return n.Color.fromHsl(50,100,s.randomRange(55,85))},modules:[(new o.ModuleBuilder).drive("rotation").by((function(e){return new n.Vector(0,0,200).scale(e)})).relative().build(),(new o.ModuleBuilder).drive("size").by(new n.NumericSpline({time:0,value:0},{time:.3,value:1},{time:.7,value:1},{time:1,value:0})).through("relativeLifetime").relative().build(),(new o.ModuleBuilder).drive("opacity").by(new n.NumericSpline({time:0,value:1},{time:.5,value:1},{time:1,value:0})).through("relativeLifetime").build()]},t);return i.scene.current.createEmitter({emitterOptions:{loops:1,duration:3,useGravity:!1,modules:r.modules},emissionOptions:{rate:0,bursts:[{time:0,count:r.count}],sourceSampler:a.dynamicSource(e),angle:c.range(0,360),initialLifetime:r.lifetime,initialSpeed:r.speed,initialSize:r.size,initialRotation:r.rotation,initialColor:r.color},rendererOptions:{applyLighting:void 0,shapeFactory:"star"}})}},"./src/util/config.ts":(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.overrideDefaults=void 0,t.overrideDefaults=function(e,t){return Object.assign({},e,t)}},"./src/util/index.ts":function(e,t,r){var i=this&&this.__createBinding||(Object.create?function(e,t,r,i){void 0===i&&(i=r),Object.defineProperty(e,i,{enumerable:!0,get:function(){return t[r]}})}:function(e,t,r,i){void 0===i&&(i=r),e[i]=t[r]}),n=this&&this.__exportStar||function(e,t){for(var r in e)"default"===r||Object.prototype.hasOwnProperty.call(t,r)||i(t,e,r)};Object.defineProperty(t,"__esModule",{value:!0}),n(r("./src/util/config.ts"),t),n(r("./src/util/rotation.ts"),t),n(r("./src/util/rules.ts"),t),n(r("./src/util/lazy.ts"),t)},"./src/util/lazy.ts":(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.Lazy=void 0;var r=function(){function e(t,r){void 0===r&&(r=e.defaultExists),this.factory=t,this.exists=r}return Object.defineProperty(e.prototype,"current",{get:function(){return this.exists(this.value)||(this.value=this.factory()),this.value},enumerable:!1,configurable:!0}),e.defaultExists=function(e){return void 0!==e},e}();t.Lazy=r},"./src/util/rotation.ts":(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.rotationToNormal=void 0;var i=r("./src/components/index.ts"),n=r("./src/systems/math.ts");t.rotationToNormal=function(e){var t=e.x*n.deg2rad,r=e.y*n.deg2rad,o=new i.Vector(Math.cos(r),0,Math.sin(r)),s=new i.Vector(0,Math.cos(t),Math.sin(t));return o.cross(s)}},"./src/util/rules.ts":(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.despawningRules=void 0,t.despawningRules={lifetime:function(e){return e.lifetime<=0},bounds:function(e){var t=document.documentElement.scrollHeight;return e.location.y>t}}}},t={};var r=function r(i){var n=t[i];if(void 0!==n)return n.exports;var o=t[i]={exports:{}};return e[i].call(o.exports,o,o.exports,r),o.exports}("./src/index.ts");return r=r.default})()}));


function number_format(number, decimals, dec_point, thousands_sep) {
    var decimals = decimals || 0;
    var n = number, c = isNaN(decimals = Math.abs(decimals)) ? 2 : decimals;
    var d = dec_point == undefined ? "." : dec_point;
    var t = thousands_sep == undefined ? "," : thousands_sep, s = n < 0 ? "-" : "";
    var i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", j = (j = i.length) > 3 ? j % 3 : 0; 
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
}

function freeaccountaction(action) {
    if(action=='show') {
        showmodal2(350,150);
        getaddon('/@install','freeaccountaction=1&action='+action,'showdiv_modal2',function(r){
            freeaccountaction('install');
        });
    } else if(action=='install') {
        getaddon('/@install','freeaccountaction=1&action='+action,'spacerdiv',function(r){
            if(r && r.ok) {
                document.location.href = 'https://app.advalify.'+tld+'/workspaces';
            }
        });
    }
}
function getsignup2() {
    showmodal2(2000,2000,1,1);
    getObject('showdiv_modal2').style.overflow = 'hidden';
    getObject('showdiv_modal2').innerHTML = "<iframe style='vertical-align:middle; width:100%; height:100%;' frameborder=0 src='https://app.advalify."+tld+"/letsgo'></iframe>";
    window.closemodal2 = function(){};
}

var lineChart = {
    draw:function(obj,fill,type,colors,max_y,fill,stroke) {
        if(!obj) return;
        if(!type) type = 'line';
        if(!colors) colors = ['#1D75BD','#c0584f'];
        if(!fill) fill = [true,false];
        if(!stroke) stroke = [4,2];
        if(obj.dataset.rendered == 'yes') return;
        
        
        /*
        //allows for 100% width, but only when the canvas is visible
        if(!obj.height || !obj.width) {
            var rect = obj.getClientRects()[0];
            var width = (rect && Math.floor(rect['width']) || 0);
            var height = (rect && Math.floor(rect['height']) || 0);
            if(width==0 || height==0) return; //canvas not visible
        } else {
            //width/height set in the object
            var width = parseInt(obj.width);
            var height = parseInt(obj.height);
        }
        */
        //allows for 100% width, but only when the canvas is visible
        var rect = obj.getClientRects()[0];
        var width = (rect && Math.floor(rect['width']) || 0);
        var height = (rect && Math.floor(rect['height']) || 0);
        if(width==0 || height==0) {
            var width = parseInt(obj.width);
            var height = parseInt(obj.height);
        }
        
        obj.dataset.rendered = 'yes';
        obj.height = height;
        obj.width = width;
        
        var canvas = obj, ctx = canvas.getContext('2d');
        
        if(type=='line') {
            var lines = canvas.dataset.values.split('|');
            //var_stroke_opacity = lines.length>1 ? 80 : '';
            var_stroke_opacity = '';
            
            //calculate max
            var max = 0;
            if(max_y && max_y>0) max = parseFloat(max_y);
            else {
                for(var j=0; j<lines.length; j++) {
                    var data = lines[j].split(',').map( function(x){ return parseFloat(x)||0; });
                    var this_max = Math.max.apply(null, data) || 1;
                    if(this_max > max) max = this_max;
                }
            }
            if(max==0) max = 1;
            
            //draw lines
            for(var j=0; j<lines.length; j++) {
                var data = lines[j].split(',').map( function(x){ return parseFloat(x)||0; });
                
                //if single data point, show flat line
                if(data.length==1) {
                    data = [0,0];
                }
                
                var thisstroke = stroke[j];
                var xstep = (width + thisstroke) / (data.length-1);
                var x = thisstroke*-2;
                var y = this.calculateY(data, 0, height, max, thisstroke);
                
                ctx.beginPath();
                ctx.moveTo(x, height);
                ctx.strokeStyle = colors[j]+var_stroke_opacity;
                ctx.lineWidth = thisstroke;
                ctx.lineJoin = 'round';
                
                for(var i=0; i<data.length; i++) {
                    y = this.calculateY(data, i, height, max, thisstroke);
                    ctx.lineTo(x, y);
                    x += xstep;
                }
                ctx.stroke();
                
                if(fill[j]) {
                    ctx.fillStyle = colors[j]+'38';
                    ctx.lineTo(x-xstep, height);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            
        } else if(type=='bar') {
            var data = canvas.dataset.values.split(',').map( function(x){ return parseFloat(x)||0; });
            var max = (max_y) ? max_y : Math.max.apply(null, data) || 1;
            const gap = 2;
            const strokeWidth = 2;
            const barWidth = (width - ((data.length - 1) * gap) - (data.length * strokeWidth * 2)) / data.length;
            const chartHeight = canvas.height;
            const startX = strokeWidth;
            
            //ctx.fillStyle = "#f0f0f0";
            //ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            function drawBar(x, height) {
                if(height <= strokeWidth) height = strokeWidth;
                ctx.strokeStyle = '#2C82C9';
                ctx.fillStyle = '#2C82C980';
                ctx.lineWidth = strokeWidth;
                ctx.fillRect(x, chartHeight - height+1, barWidth, height);
                ctx.strokeRect(x, chartHeight - height+1, barWidth, height);
            }
            let x = startX;
            for (let i = 0; i < data.length; i++) {
                const barHeight = (data[i] / max) * chartHeight;
                drawBar(x, barHeight);
                x += barWidth + gap + (strokeWidth*2);
            }
        }
    },
    calculateY:function(data, index, height, max, stroke) {
        var valueRatio = data[index] / max * (height - (2*stroke));
        return height - valueRatio - stroke;
    }
}

var lineChartOLD = {
    draw:function(obj,fill) {
        
        //allows for 100% width, but only when the canvas is visible
        var rect = obj.getClientRects()[0];
        var width = Math.floor(rect['width'] || 0);
        var height = Math.floor(rect['height'] || 0);
        if(width==0 || height==0) return; //canvas not visible
        
        if(obj.dataset.rendered == 'yes') return;
        obj.dataset.rendered = 'yes';
        obj.height = height;
        obj.width = width;
        
        var canvas = obj,
        ctx = canvas.getContext('2d'),
        data = canvas.dataset.values.split(',').map( function(x){ return parseFloat(x)||0; }),
        max = Math.max.apply(null, data) || 1,
        stroke = 2,
        xstep = (width + stroke) / (data.length-1),
        x = stroke*-2,
        y = this.calculateY(data, 0, height, max, stroke);
        
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.strokeStyle = '#2C82C9';
        ctx.lineWidth = stroke;
        ctx.lineJoin = 'round';
        
        for(var i=0; i<data.length; i++) {
            y = this.calculateY(data, i, height, max, stroke);
            ctx.lineTo(x, y);
            x += xstep;
        }
        ctx.stroke();
        
        if(fill) {
            ctx.fillStyle = '#2C82C938';
            ctx.lineTo(x-xstep, height);
            ctx.closePath();
            ctx.fill();
        }
    },
    calculateY:function(data, index, height, max, stroke) {
        var valueRatio = data[index] / max * (height - (2*stroke));
        return height - valueRatio - stroke;
    }
}
function notify(msg) {
    getaddon('/@settings','notify=1&msg='+encodeURIComponent(msg),'notifydiv',function(){});
}
function getI() {
   if(!localStorage.getItem('i')) localStorage.setItem('i',Math.random().toString(36).substr(2, 10));
  return localStorage.getItem('i') || 'unknown';
}
function getinfo(job_id,what,test,color,actual,expected,can_fix) {
    showmodal2(500,600);
    getaddon('/@info','job_id='+job_id+'&what='+what+'&test='+test+'&color='+color+'&actual='+actual+'&expected='+expected+'&can_fix='+can_fix,'showdiv_modal2',function(r) {
        
    });
}
function upgradeaction(action,data,meta) {
    if(action=='get') {
        showmodal2(1000);
        getaddon('/@settings','upgradeaction=1&action='+action+'&why='+(data||''),'showdiv_modal2',function(r) {
            if(r && r.require_signup) {
                closemodal2();
                loginaction('get','upgrade');
                return;
            }
            if(r && r.already_upgraded) {
                closemodal2();
                myconfirm.open('You are already upgraded','Please refresh the page!');
                return;
            }
            if(r && r.ok) {
                upgradeaction('load_stripe',function(){
                    upgradeaction('initStripCard',r.pk);
                    upgradeaction('getclientsecret');
                });
            }
        });
    } else if(action=='change_card') {
        showmodal2(500);
        getaddon('/@settings','upgradeaction=1&action='+action,'showdiv_modal2',function(r) {
            if(r && r.ok) {
                upgradeaction('load_stripe',function(){
                    upgradeaction('initStripCard',r.pk);
                    upgradeaction('getclientsecret');
                });
            }
        });
    } else if(action=='load_stripe') {
        if(typeof window.Stripe !== 'function') {
            (function(r,d,u) {
                var s = d.createElement(r); s.async = true;   
                s.addEventListener('load', function() {
                    data();
                });
                s.src = u; var n = d.getElementsByTagName(r)[0];
                n.parentNode.insertBefore(s, n);
            })('script',document,'https://js.stripe.com/v3/');
        } else {
            data();
        }
    } else if(action=='getclientsecret') {
        getaddon('/@settings','upgradeaction=1&action='+action,'spacerdiv',function(r) {
            if(!r.ok) return;
            clientSecret = r.secret;
        });
    } else if(action=='initStripCard') {
        stripe = Stripe(data,{'locale':'en'});
        elements = stripe.elements();
        cardElement = elements.create('card', {hidePostalCode:true, style:{
           base: {
              iconColor: '#888888',
              color: '#333333',
              fontWeight: 500,
              fontFamily: 'Agane, Arial',
              fontSize: '20px',
              '::placeholder': {
                color: '#d0d0d0'
              },
            }, 
        }});
        cardElement.mount('#card-element');
        cardElement.on('ready', function(event) {
            //setTimeout(function(){ cardElement.focus(); },300);
        });
    } else if(action=='signup_test') {
        getaddon('/@settings','upgradeaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
          if(!r.ok) {
              getObject('btn_card').disabled = false;
              hide('progressbar_signup');
              return;
          } else {
              document.location.href = '/';
          }
        });
    } else if(action=='signup') {
        if(!getObject('agree').checked) {
            shake('div_agree');
            return;
        }
        if(isVisible('div_vat_eu') && getObject('vat').value=='') {
            shake('vat');
            return;
        }
        getObject('btn_card').disabled = true;
        show('progressbar_signup');
        
        window.setTimeout(function() {
            if(!window.clientSecret) {
                myconfirm.open('Not ready yet','Please wait 30 more seconds, then try again. Contact support if you need further help.');
                getObject('btn_card').disabled = false;
                hide('progressbar_signup');
                notify('signup: client_secret not ready yet, user clicked already');
                return;
            }
            stripe.handleCardSetup(
                window.clientSecret, cardElement, {
                    payment_method_data: {}
                }
              ).then(function(result) {
                if(result.error) {
                    myconfirm.open('There was an error','Message from your bank: '+foolproof(result.error.message));
                    getObject('btn_card').disabled = false;
                    hide('progressbar_signup');
                    notify('signup: error from bank: '+result.error.message);
                    return;
                } else {
                  if(result.setupIntent.status=='succeeded') {
                      getaddon('/@settings','upgradeaction=1&action='+action+'&payment_method='+result.setupIntent.payment_method+wrapformdata(data),'spacerdiv',function(r){
                          if(!r.ok) {
                              getObject('btn_card').disabled = false;
                              hide('progressbar_signup');
                              return;
                          } else {
                              document.location.href = '/scans';
                          }
                      });
                  } else {
                      myconfirm.open('An unknown error occured (3)','Please contact support.');
                      getObject('btn_card').disabled = false;
                      hide('progressbar_signup');
                      notify('signup: An unknown error occured (3)');
                      return;
                  }
                }
            });
        },((!window.clientSecret)?10000:10));
    } else if(action=='do_change_card') {
        getObject('btn_card').disabled = true;
        show('progressbar_signup');
        
        window.setTimeout(function() {
            if(!window.clientSecret) {
                myconfirm.open('Not ready yet','Please wait 30 more seconds, then try again. Contact support if you need further help.');
                getObject('btn_card').disabled = false;
                hide('progressbar_signup');
                notify('signup: client_secret not ready yet, user clicked already');
                return;
            }
            stripe.handleCardSetup(
                window.clientSecret, cardElement, {
                    payment_method_data: {}
                }
              ).then(function(result) {
                if(result.error) {
                    myconfirm.open('There was an error','Message from your bank: '+foolproof(result.error.message));
                    getObject('btn_card').disabled = false;
                    hide('progressbar_signup');
                    notify('signup: error from bank: '+result.error.message);
                    return;
                } else {
                  if(result.setupIntent.status=='succeeded') {
                      getaddon('/@settings','upgradeaction=1&action='+action+'&payment_method='+result.setupIntent.payment_method,'spacerdiv',function(r){
                          if(!r.ok) {
                              getObject('btn_card').disabled = false;
                              hide('progressbar_signup');
                              return;
                          } else {
                              document.location.href = document.location.href;
                          }
                      });
                  } else {
                      myconfirm.open('An unknown error occured (3)','Please contact support.');
                      getObject('btn_card').disabled = false;
                      hide('progressbar_signup');
                      notify('signup: An unknown error occured (3)');
                      return;
                  }
                }
            });
        },((!window.clientSecret)?10000:10));
    }
}

var omnibox = {
    selection: [],
    isOpen: function(namespace) {
        var o = getObject('omnibox_wrapper_'+namespace);
        if(!o) return false;
        return (o.querySelector('#omnibox').classList.contains('omnibox_on'));
    },
    getNamespace: function(){
        if(isVisible('omnibox_wrapper_campaigns')) return 'campaigns';
        console.log('Omnibox: Cannot find namespace.');
    },
    master: function(clear) {
        if(clear===0) getObject('omnibox_master_'+omnibox.getNamespace()).checked = false; 
        myEach('input_mycheckbox',function(){
            if(this.id == 'omnibox_master_'+omnibox.getNamespace()) return;
            this.checked = getObject('omnibox_master_'+omnibox.getNamespace()).checked;
        },'omnibox_wrapper_'+omnibox.getNamespace());
        this.sync();
    },
    sync: function() {
        if(event && event.shiftKey===true) {
            var end_input = event.target.closest('td').querySelector('.input_mycheckbox');
            var all_inputs = event.target.closest('table').querySelectorAll('.input_mycheckbox');
            var start_input = null;
            for(var i=0; i<all_inputs.length; i++) {
                if(all_inputs[i] == end_input) break;
                if(all_inputs[i].checked) {
                    start_input = all_inputs[i];
                }
            }
            if(start_input) {
                var do_check = false;
                for(var i=0; i<all_inputs.length; i++) {
                    if(all_inputs[i] == start_input) {
                        do_check = true;
                        continue;
                    }
                    if(do_check) all_inputs[i].checked = true;
                    if(all_inputs[i] == end_input) {
                        do_check = false;
                    }
                }
            }
        }
        this.selection = [];
        var c = true, a = false;
        myEach('input_mycheckbox',function() {
            if(this.id == 'omnibox_master_'+omnibox.getNamespace()) return;
            if(!this.checked) c = false;
            else {
                a = true;
                omnibox.selection.push(this.id.replace('omnibox_',''));
            }
        },'omnibox_wrapper_'+omnibox.getNamespace());
        getObject('omnibox_master_'+omnibox.getNamespace()).checked = c;
        this.toggle(a);
        getObject('span_omnibox_selected','omnibox_wrapper_'+omnibox.getNamespace()).innerHTML = this.selection.length;
    },
    toggle: function(onoff) {
        if(onoff) getObject('omnibox','omnibox_wrapper_'+omnibox.getNamespace()).classList.add('omnibox_on');
        else getObject('omnibox','omnibox_wrapper_'+omnibox.getNamespace()).classList.remove('omnibox_on');
    },
    opacity: function(onoff) {
        if(onoff) getObject('omnibox_wrapper_'+omnibox.getNamespace()).classList.add('op50');
        else getObject('omnibox_wrapper_'+omnibox.getNamespace()).classList.remove('op50');
    }
}

function backupaction(action,data,meta) {
    if(action=='get') {
        showmodal2(600);
        getaddon('/@settings','backupaction=1&action='+action+'&job_id='+data,'showdiv_modal2',function(r) {
            
        });
    }
    if(action=='generate') {
        show('progressbar_infinite');
        getObject('btn_submit').disabled = true;
        getaddon('/@settings','backupaction=1&action='+action+wrapformdata(data),'showdiv_modal2',function(r) {
            if(r && r.ok) showmodal2(1000);
            else closemodal2();
        },1);
    }
} 
function confetti() {
    setTimeout(function(){ if(getObject('confetti1')) party.sparkles(getObject('confetti1'),{count:50}); },300);
    setTimeout(function(){ if(getObject('confetti2')) party.sparkles(getObject('confetti2'),{count:50}); },500);
    setTimeout(function(){ if(getObject('confetti3')) party.sparkles(getObject('confetti3'),{count:50}); },400);
}

function invoiceaction(action,data,meta) {
    if(action=='get') {
        showmodal2(1200);
        getaddon('/@settings','invoiceaction=1&action='+action+'&ID='+data,'showdiv_modal2',function(r){
        });
    } else if(action=='get_settings') {
        showmodal2(600);
        getaddon('/@settings','invoiceaction=1&action='+action,'showdiv_modal2',function(r){
            
        });
    } else if(action=='save_settings') {
        getaddon('/@settings','invoiceaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
            }
        });
    } 
}

function specaction(action,data,meta) {
    if(action=='get_add') {
        showmodal2(450);
        getaddon('/@settings','specaction=1&action='+action,'showdiv_modal2',function(r){
            setFocus('name');
        });
    } else if(action=='do_add') {
        getaddon('/@settings','specaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            if(r.ok) {
                specaction('get',r.spec_id);
                settingsaction('get','ad_specs');
            }
        });
    } else if(action=='get') {
        showmodal2(900);
        getaddon('/@settings','specaction=1&action='+action+'&spec_id='+data,'showdiv_modal2',function(r){
        });
    } else if(action=='save') {
        show('progressbar_infinite');
        getObject('btn_submit').disabled = true;
        getaddon('/@settings','specaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            hide('progressbar_infinite');
            getObject('btn_submit').disabled = false;
            if(r && r.ok) {
                closemodal2();
                settingsaction('get','ad_specs');
            }
        });
    } else if(action=='duplicate') {
        getaddon('/@settings','specaction=1&action='+action+'&spec_id='+data,'spacerdiv',function(r){
            if(r && r.ok) {
                closemodal2();
                settingsaction('get','ad_specs');
            }
        });
    } else if(action=='delete') {
        myconfirm.open('Are you sure?','Removal is irreversible. All creatives with this ad specification will be re-validated against IAB guidelines.',function(){
            getaddon('/@settings','specaction=1&action='+action+'&spec_id='+data,'spacerdiv',function(r){
                closemodal2();
                settingsaction('get','ad_specs');
            });
        },true);
    } else if(action=='changename') {
        var obj = data.name;
        if(!obj) return;
        var name = obj.value;
        if(obj.getAttribute('data-oldname') == name) return;
        obj.setAttribute('data-oldname',name);
        getaddon('/@settings','specaction=1&action='+action+wrapformdata(data),'spacerdiv',function(r){
            settingsaction('get','ad_specs');
        });
    } else if(action=='handle_spec_table') {
        var tr = meta.closest('tr');
        if(getObject('checkbox_'+data).checked) {
            getObject('td1_test_'+data).style.visibility = 'visible';
            getObject('td2_test_'+data).style.visibility = 'visible';
            getObject('td3_test_'+data).style.visibility = 'visible';
        } else {
            getObject('td1_test_'+data).style.visibility = 'hidden';
            getObject('td2_test_'+data).style.visibility = 'hidden';
            getObject('td3_test_'+data).style.visibility = 'hidden';
        }
    }
}
var radioIcons = {
    toggle: function(obj,id,val,allow_multi){
        if(allow_multi===true) {
            var tmp = JSON.parse(getObject(id).value) || [];
            if(tmp.indexOf(val)!==-1) {
                tmp.splice(tmp.indexOf(val),1);
                obj.classList.remove('radioicon_on');
            } else {
                tmp.push(val);
                obj.classList.add('radioicon_on');
            }
            getObject(id).value = JSON.stringify(tmp);
        } else {
            getObject(id).value = val; 
            myEach('radioicon',function(){
                this.classList.remove('radioicon_on');
            },'div_wrapper_radioicon_'+id);
            obj.classList.add('radioicon_on');
        }
    },
}
function mySearch(o) {
    let query = o.value.toLowerCase();
    let wrapper = o.closest('.search_wrapper');
    wrapper.querySelectorAll('.searchable').forEach(el => {
        let content = el.getAttribute('data-search-content').toLowerCase();
        el.style.display = content.includes(query) ? '' : 'none';
    });
}
function base64_encode(str) {
    //UTF-8 safe
    return btoa(unescape(encodeURIComponent(str)));
}
function base64_decode(str) {
    return atob(str);
}
