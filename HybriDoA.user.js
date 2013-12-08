// ==UserScript==
// @name          HybriDoA
// @namespace     fr.kergoz-panic.watilin
// @version       0.1
// @description   Projet de remplacer le SWF par du pur HTML5
//
// @include       https://www.kabam.com/fr/games/dragons-of-atlantis/play*
// @match         https://*.castle.wonderhill.com/platforms/kabam/*
//
// @icon          hybridoa.png
// @resource      html        hybridoa.html
// @resource      style       hybridoa.css
// @resource      terrains    terrains-sprite.png
//
// @run-at        document-start
// @grant         GM_xmlhttpRequest
// @grant         GM_getResourceText
// @grant         GM_getResourceURL
//
// @homepage      https://github.com/Watilin/HybriDoA#hybridoa
// @author        Watilin
// @copyright     2013+, Watilin
// @license       Creative Commons by-nc-sa
// ==/UserScript==

/* >>>>>>>>>>>>>>>>>>>>>>> IMPORTANT! <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

This script is currently a DRAFT. I’m using it to test the feasability
of my goals. It includes defective or incomprehensible features, and
perhaps even security flaws. DO NOT INSTALL IT unless you want to follow
up my work or get inspired by it.
*/

/* Marks:
   todo, xxx, here, temp
*/

/* TODO
Views
   - a Main City view (buildings & levels)
   - a Map view (terrains & owners)
   - a jobs list
   - a Main City's fields view
   - a view of each outpost (fields & city)

Actions
   - creating/enhancing buildings
   - sending marches
   - training troops
   - researching

Messages
   - viewing old pages
   - deleting one or more messages

Alliance
   - a member's list with sorting features

Automatization
   (to be defined)

Script
   - keyboard shortcut handling
   - i18n

Style
   -
*/

/* Table Of Contents

Sections are label with arobases (@). Use the “search” function to
navigate between sections. For example, for section [XYZ], type “@XYZ”.
  [NAV] Browser Detection
  [UTI] Misc Utilities
  [DBG] Debug Utilities
  [WIN] Window Constructor
  [MOD] Modules
  [DAT] Game Data
  [INI] Script Initialization
  [AJX] Ajax Primitives
  [SHA] A JavaScript Implementation of Sha-1
*/

"use strict";

// [@NAV] Browser Detection ////////////////////////////////////////////

var ua = navigator.userAgent;
var FIREFOX = ua.search(/firefox/i) >= 0;

// set to false when we won't need GM_xmlhttpRequest anymore
var USE_GM_XHR = true;

// [@UTI] Misc Utilities ///////////////////////////////////////////////

// object extension
Object.extend = function extend( subject, properties ){
   subject = subject || {};
   for (var p in properties)
      subject[p] = properties[p];
   return subject;
};

// Gives and approximative description of the elapsed duration between
// the given date and now, overviewing too small units
Date.prototype.ago = (function( ){
   var durations = {
           "an": 31536000000,
         "mois": 2592000000,
      "semaine": 604800000,
         "jour": 86400000,
        "heure": 3600000,
       "minute": 60000,
      "seconde": 1000
   };
   return function ago( ){
      var diff = Math.abs(Date.now() - this);
      for (var name in durations) {
         var duration = durations[name];
         if (diff >= duration) {
            var unit = Math.floor(diff / duration);
            return unit + " " + name + (!/s$/.test(name) && unit > 1 ?
               "s" : "");
         }
      }
      return "moins d’une seconde";
   }
}());

// Gives a string formatted as dd/mm/yy hh:mm:ss
Date.prototype.toShortFormat = function( ){
   var date = this.getDate().pad(2);
   var month = (this.getMonth() + 1).pad(2);
   var year = (this.getFullYear() % 100).pad(2);

   var hours = this.getHours().pad(2);
   var minutes = this.getMinutes().pad(2);
   var seconds = this.getSeconds().pad(2);

   var days = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
   return days[this.getDay()] + " " +
      date + "/" + month + "/" + year + " " +
      hours + ":" + minutes + ":" + seconds;
};

// Detects scrollbars size
var Scrollbars = (function( ){
   var w;
   var h;
   var $box = document.createElement("div");
   var style = $box.style;
   style.overflow = "scroll";
   style.width = "100px";
   style.height = "100px";
   style.position = "absolute";
   style.top = "-200px";
   document.documentElement.appendChild($box);
   setTimeout(function( ){
      w = 100 - $box.clientWidth;
      h = 100 - $box.clientHeight;
      document.documentElement.removeChild($box);
   }, 0);
   return {
      get width( ) w,
      get height( ) h
   }
}());

// Tranforms the number into string, padding with zeros if needed
Number.prototype.pad = function pad( digits ){
   var str = "" + this;
   var length = ("" + this).length;
   var zeros = digits - length;
   if (zeros > 0)
      return new Array(zeros + 1).join("0") + str;
   else
      return str;
}

// transforms the number in milliseconds into a string representation of
// a time interval. Example: 9999d 23h 59mn 59s
Number.prototype.toTimeInterval = function( ){
   var s = this % 60 + "s";
   var t = this / 60 | 0;
   if (!t) return s;
   s = t % 60 + "mn " + s;
   t = t / 60 | 0;
   if (!t) return s;
   s = t % 24 + "h " + s;
   t = t / 24 | 0;
   if (!t) return s;
   return t + "d " + s;
};

/** DOM attributes management
 * @method remove
 *    removes one or more attributes from an element
 *    @param $element
 *       the element from which remove the attributes
 *    @param attributes
 *       the attribute(s) to be removed
 *
 * @method removeAll
 *    remove all of an element's attributes, except those given
 *    @param $element
 *       the element from which remove the attributes
 *    @param except (optional)
 *       zero, one or more attributes not to be removed
 */
var Attribute = {
   remove: function( $element, attributes ){
      attributes = attributes instanceof Array ?
         attributes : Array.slice(arguments, 1);
      Array.forEach(attributes, function( arg ){
         var attr = "" + arg;
         if ($element.hasAttribute(attr))
            $element.removeAttribute(attr);
      });
   },
   removeAll: function( $element, except ){
      except = except instanceof Array ?
         except : Array.slice(arguments, 1);
      except = except.map(function( item ) "" + item).sort();
      var attributes = Array.map($element.attributes,
         function( attr ) attr);
      Array.forEach(attributes, function( attr ){
         var name = attr.name;
         if (except.indexOf(name) < 0) $element.removeAttribute(name);
      });
   }
};

/** Simplified button creation
 * @param name
 *    the button's visible name
 * @param options (optional)
 *    a map containing zero, one or more of the following options:
 *    - className    one or more HTML classes to be added to the button
 *    - onclick      a click event handler
 *    - title        the text of the tooltip showing on mouseover
 */
function createButton( name, options ){
   options = options || {};

   var $button = document.createElement("a");
   $button.textContent = name;

   $button.classList.add("button");
   if (options.className) $button.classList.add(options.className);

   $button.href = "#";
   $button.onclick = function( event ){
      event.preventDefault();
      if (options.onclick) options.onclick.call($button, event);
   };

   if (options.title) $button.title = options.title;

   return $button;
}

// communication between Kabam and Wonderhill domains
var currentHost = location.hostname.match(/(\w+)\.\w+$/)[1];
var wonderhillOrigin;
var wonderhillWindow;
switch (currentHost) {
   case "kabam":
      window.onmessage = function( message ){
         // at first the "kabam" part of the script doesn't know the
         // Wonderhill server's full name, so we test it against a
         // regexp, then we store the real name.
         var origin = message.origin;
         debug("[K<-W] ", message);
         if (wonderhillOrigin) {
            if (origin != wonderhillOrigin) return;
         } else {
            var regexp =
               /^https:\/\/realm\d+\.c\d+\.castle\.wonderhill\.com$/;
            if (!origin.match(regexp)) return;
            wonderhillOrigin = origin;
         }

         // To keep things simple, messages will exclusively contain
         // functions to be excuted within the other window's context.
         // However, messages can't directly transport functions, so
         // we have to serialize them with `toString` and deserialize
         // them with `eval`.
         var code = message.data.code;
         try {
            if (code) eval(code);
         } catch (error) {
            alert(error);
         }
      }

      var executeOnWonderhill = function execW( f ){
         wonderhillWindow.postMessage({ code: f.toString() },
            wonderhillOrigin);
      };
      break;
   case "wonderhill":
      wonderhillWindow = this;
      // the first message allows the "kabam" part to know the full name
      // of the Wonderhill server.
      top.postMessage("hi", "https://www.kabam.com");

      window.onmessage = function( message ){
         debug("[K->W] ", message);
         if ("https://www.kabam.com" != message.origin) return;

         var code = message.data.code;
         try {
            if (code) eval(code);
         } catch (error) {
            alert(error);
         }
      }

      var executeOnKabam = function execK( f ){
         top.postMessage({ code: f.toString() },
            "https://www.kabam.com");
      };
      break;
}

// recursively replaces functions of the given object with their source
// code, thus allowing it to be sent via postMessage
function serializeFunctions( arg ){
   // basic type case
   if ("object" != typeof arg)
      return arg;

   // array case
   if (arg instanceof Array)
      return arg.map(item => serializeFunctions(item));

   // object case
   var clone = {};
   for (var name in arg) if (arg.hasOwnProperty(name)) {
      var prop = arg[name];
      if ("function" == typeof prop)
         clone[name] = prop.toString();
      else
         clone[name] = serializeFunctions(prop);
   }
   return clone;
}

// [@DBG] Debug Utilities //////////////////////////////////////////////

// displays the object in the available console
var debug = (function( ){
   var c = unsafeWindow.console || console;
   if (c) return c.debug || c.log;
   return function( ){};
}());

// makes the object visible in the page's context
var expose = top === window ?
   (function( ){
      var exposeName;
      var exposeArray = [];
      return function expose( obj, name ){
         if (name) {
            debug("exposed `" + name + "` in the main page's context");
            unsafeWindow[name] = obj;
         } else {
            if (!exposeName) {
               // picks a name that doesn't exist yet
               exposeName = "exposed_";
               while (exposeName in unsafeWindow) {
                  exposeName += Math.random().toString(36).substr(2);
               }
               unsafeWindow[exposeName] = exposeArray;
            }
            debug("exposed anonymous contents in `" + exposeName + "`");
            exposeArray.push(obj);
         }
      };
   }()) :
   function expose( obj, name ){
      executeOnKabam("expose(" +
         JSON.stringify(serializeFunctions(obj)) +
         ", '" +
         (name ? name.replace(/'/g, "\\'") : "") +
         "');");
   };

// [@WIN] Window Constructor ///////////////////////////////////////////

function Window( title, $control ){
   var $ = Window.template.cloneNode(true);
   this.$window = $;
   $.querySelector("h3").textContent = title;
   var that = this;
   $.querySelector("a").addEventListener("click", function( event ){
      event.preventDefault();
      that.close();
   }, false);
   this.$container = $.querySelector("div.window-container");
   this.$shader = $.querySelector("div.window-shader");
   this.$spinner = $.querySelector("div.spinner-box");
   this.$error = $.querySelector("section.error");
   document.body.appendChild($);

   window.addEventListener("resize", function( ){
      that.center();
   }, false);

   this.$window.addEventListener("transitionend", function( event ){
      if (event.propertyName == "opacity") {
         if ("0" == this.style.opacity) {
            this.style.display = "none";
            that.isOpened = false;
         }
      }
   });

   this.$control = $control;
}

Window.prototype = {

   $window: null,
   $container: null,
   $shader: null,
   $spinner: null,
   $error: null,
   $control: null,
   isOpened: false,

   open: function open( ){
      if (this.$control) this.$control.classList.add("lit");
      var style = this.$window.style;
      style.display = "block";
      style.opacity = "0";
      setTimeout(function( ){ style.opacity = "1"; }, 0);
      this.isOpened = true;
      this.center();
   },

   center: function( ){
      if (this.isOpened) {
         var style = this.$window.style;
         var $body = document.body;
         var computed = getComputedStyle(this.$window, null);
         var computedW = parseInt(computed.width);
         var computedH = parseInt(computed.height);
         var windowW = window.innerWidth;
         var windowH = window.innerHeight;
         var extraW = (windowH > $body.offsetHeight) ?
            Scrollbars.width : 0;
         var extraH = (windowW > $body.offsetWidth) ?
            Scrollbars.height : 0;

         style.left = (windowW - extraW - computedW) / 2 + "px";
         style.top = (windowH - extraH - computedH) / 2  +"px";
      }
   },

   close: function close( ){
      if (this.$control) this.$control.classList.remove("lit");
      this.$window.style.opacity = "0";
      // the rest is achieved by the "transitionend" listener
   },

   /** Cleans the window then inserts the given contents
    * @argument contents (optional)
    *    a String or a HTMLElement or an array of HTMLElements
    *    if String, fills using `textContent`;
    *    otherwise, adds the element using `appendChild`.
    */
   update: function update( contents ){
      this.clear();
      var $container = this.$container;
      if (contents instanceof Array) {
         contents.forEach(function( c ){ $container.appendChild(c); });
      } else if ("string" == typeof contents) {
         $container.textContent = contents;
      } else {
         $container.appendChild(contents);
      }
      this.center();
   },

   /** Empties the window's container and hides its' shader and error
    * message.
    */
   clear: function clear( ){
      this.$container.innerHTML = "";
      this.$shader.style.display = "none";
      this.$error.style.display = "none";
   },

   /** Darkens the window and displays a loading indicator (spinner).
    * By calling `wait`, you notify that the window's contents
    * is not up-to-date anymore, and you won't be able to access it.
    * Using `update` or `clear` will remove the shadow and the spinner.
    */
   wait: function wait( ){
      this.$shader.style.display = "block";
      var $w = this.$window;
      var $spinner = this.$spinner;
      var computed = getComputedStyle($spinner, null);
      var width = parseInt(computed.width, 10);
      var height = parseInt(computed.height, 10);
      var style = $spinner.style;
      style.paddingLeft = ($w.offsetWidth - width) / 2 + "px";
      style.paddingTop = ($w.offsetHeight - height) / 2 + "px";
   },

   /** Displays an error message, and possibly attaches an action
    * to be executed once the user has read the message
    * @param {string} title     The error message's title
    * @param {string} message   The error message
    * @param {function} next    (optional) the action to be executed
    */
   error: function error( title, message, next ){
      this.$shader.style.display = "block";

      var $spinner = this.$spinner;
      $spinner.style.display = "none";
      var $error = this.$error;
      $error.style.display = "block";

      $error.querySelector("h4").textContent = title;
      $error.querySelector("p").textContent = message;

      var w = this;
      var $window = w.$window;
      setTimeout(function( ){
         $window.style.minWidth = $error.offsetWidth + "px";
         $window.style.minHeight = $error.offsetHeight + "px";
      }, 0);

      function click( ){
         this.removeEventListener("click", click, false);
         $error.style.display = "none";
         $spinner.style.display = "";
         w.$shader.style.display = "none";
         $window.style.minWidth = "";
         $window.style.minHeight = "";
         if (next) next(w);
      }
      $error.querySelector("a.button").
         addEventListener("click", click, false);
   }
};

/* <window>
      <title/>
      <closeButton/>
      <container>
         ... window contents here
      </container>
      <shader>
         <spinner>
            <spinnerLeft/>
            <spinnerMiddle/>
            <spinnerRight/>
         </spinner>
         <error>
            ... error message
         </error>
      </shader>
   </window>
*/

Window.template = (function( ){
   var $window = document.createElement("section");
   $window.classList.add("window");

   var $title = document.createElement("h3");
   $window.appendChild($title);

   var $closeButton = createButton("X", {
      className: "close-button",
      title: "Fermer"
   });
   $window.appendChild($closeButton);

   var $container = document.createElement("div");
   $container.classList.add("window-container");
   $window.appendChild($container);

   var $shader = document.createElement("div");
   $shader.classList.add("window-shader");
   $window.appendChild($shader);

   var $spinner = document.createElement("div");
   var $spinnerLeft = document.createElement("div");
   var $spinnerMiddle = document.createElement("div");
   var $spinnerRight = document.createElement("div");
   $spinner.classList.add("spinner-box");
   $spinnerLeft.classList.add("spinner-left");
   $spinnerMiddle.classList.add("spinner-middle");
   $spinnerRight.classList.add("spinner-right");
   $spinner.appendChild($spinnerLeft);
   $spinner.appendChild($spinnerMiddle);
   $spinner.appendChild($spinnerRight);
   $shader.appendChild($spinner);

   var $error = document.createElement("section");
   $error.classList.add("error");
   $shader.appendChild($error);

   var $errorHeading = document.createElement("h4");
   $errorHeading.textContent = "Erreur";
   $error.appendChild($errorHeading);

   var $errorMessage = document.createElement("p");
   $error.appendChild($errorMessage);

   var $errorButton = createButton("Vu");

   var $errorP = document.createElement("p");
   $errorP.appendChild($errorButton);
   $error.appendChild($errorP);

   return $window;
}());

// [@MOD] Modules //////////////////////////////////////////////////////

function Module( name, exec ){
   this.name = name;
   this.exec = exec;
   Module.list.push(this);
}
Module.prototype = {
   name: "",
   exec: function( ){},
   init: function( $bar ){
      var $li = document.createElement("li");
      var $button = createButton(this.name);
      $li.appendChild($button);
      $bar.appendChild($li);

      var w = new Window(this.name, $button);

      var that = this;
      $button.addEventListener("click", function( event ){
         event.preventDefault();
         if (w.isOpened) {
            w.close();
            $button.classList.remove("lit");
         } else {
            w.open();
            that.exec(w);
            $button.classList.add("lit");
         }
      }, false);
   }

};
Module.list = [];
Module.initAll = function( ){
   var $bar = document.getElementById("tests");
   Module.list.forEach(function( mod ){ mod.init($bar); });
};

new Module("Royaume", function( w ){
   w.wait();
   var locales = {
      fr: "Français",
      en: "English",
      de: "Deutsch",
      nl: "Nederlands",
      it: "Italiano",
      es: "Español",
      sv: "Svenska",
      tr: "Türkçe",
      da: "Dansk",
      pl: "Polski",
      pt: "Portuguese"
   };
   var selectedLocale = "fr";

   function refreshRealms( ){
      Ajax.get({
         url: Ajax.vars.serverUrl +
            "/platforms/kabam/lightboxes/change_realm",
         parameters: {
            signed_request: Ajax.vars.signedRequest,
            i18n_locale: selectedLocale
         },
         onload: function( response ){
            var contents = [];

            var $select = document.createElement("select");
            var $option;
            for (var loc in locales) {
               $option = document.createElement("option");
               $option.value = loc;
               $option.textContent = locales[loc];
               if (loc == selectedLocale) $option.selected = true;
               $select.appendChild($option);
            }

            var $label = document.createElement("label");
            $label.textContent = "Langue\xa0: ";
            $label.appendChild($select);
            var $p = document.createElement("p");
            $p.appendChild($label);
            var $ok = createButton("Ok", {
               className: "small",
               title: "Valider le changement de la langue",
               onclick: function( ){
                  var loc = $select.options[$select.selectedIndex].value;
                  Ajax.signedPost({
                     url: location.href,
                     parameters: { i18n_locale: loc },
                     onload: function( ){
                        selectedLocale = loc;
                        w.wait();
                        refreshRealms();
                     },
                     onerror: function( message ){
                        w.error("Erreur",
                           message + " / Ce n’est probablement " +
                              "qu’une défaillance passagère du " +
                              "réseau, veuillez réesayer.",
                           function( ){ w.close(); });
                     }
                  });
               }
            });
            $p.appendChild(document.createTextNode(" "));
            $p.appendChild($ok);
            contents.push($p);

            var $div = document.createElement("div");
            $div.innerHTML = response.response;
            var rawText = $div.textContent;

            var $table = document.createElement("table");
            var $headRow = $table.createTHead().insertRow(-1);
            var $tbody = document.createElement("tbody");
            $table.appendChild($tbody);

            var regexp = /^\S.*$/gm;
            var match;
            var $th;
            var $row;
            var $td;
            var realmId;
            var currentRealmId;
            var selectedRealmId;
            var $selectedRealm;

            for (var i = -2; match = regexp.exec(rawText); i++) {
               if (i < 0) continue;
               if (i < 5) {
                  $th = document.createElement("th");
                  $th.textContent = match[0];
                  $headRow.appendChild($th);
               } else {
                  if (!(i % 5)) {
                     realmId = parseInt(match[0], 10);
                     if (!realmId) break;
                     $row = $tbody.insertRow(-1);
                     if (realmId ==
                           location.hostname.match(/realm(\d+)/)[1]) {
                        $row.classList.add("selected-realm");
                        $selectedRealm = $row;
                        currentRealmId = realmId;
                     }
                  }
                  $td = $row.insertCell(-1);
                  $td.textContent = match[0];
               }
            }

            if (i <= 5) {
               w.error("Désolé",
                  "Je n’ai pas pu récupérer la liste des royaumes…",
                  function( ){ w.close(); });
               return;
            }

            $table.addEventListener("click", function( event ){
               var $target = event.target;
               if ("td" != $target.tagName.toLowerCase()) return;
               if ($selectedRealm)
                  $selectedRealm.classList.remove("selected-realm");
               var $tr = $target.parentNode;
               $tr.classList.add("selected-realm");
               $selectedRealm = $tr;
               selectedRealmId = $tr.firstChild.textContent * 1;
               $ok.classList[selectedRealmId == currentRealmId ?
                  "add" : "remove"]("disabled");
            }, false);

            $div = document.createElement("div");
            $div.classList.add("limited-height");
            $div.appendChild($table);
            contents.push($div);

            var $ok = createButton("Ok", {
               className: "disabled",
               title: "Valider le changement de royaume",
               onclick: function( ){
                  if (this.classList.contains("disabled")) return;
                  w.wait();
                  var realmId = $selectedRealm.firstChild.textContent;
                  Ajax.signedPost({
                     url: Ajax.vars.serverUrl +
                        "/platforms/kabam/change_realm/" + realmId,
                     responseType: "json",
                     onerror: function( message ){
                        w.error("Erreur", message, function( ){
                           w.close();
                        });
                     },
                     onload: function( response ){
                        var wiseUrl = response.response.realmwiseurl;
                        if (!wiseUrl) {
                           w.error("Erreur",
                              "Je n’ai pas obtenu l’adresse du royaume",
                              function( ){ w.close(); });
                           return;
                        }
                        Ajax.signedPost({
                           url: wiseUrl,
                           responseType: "json",
                           onload: function( wiseResponse ){
                              if (wiseResponse.response.success) {
                                 top.location.href = Ajax.vars.appPath;
                              } else {
                                 w.error("Erreur",
                                    "Je ne peux pas joindre le " +
                                       "nouveau royaume",
                                    function( ){ w.close(); });
                              }
                           }
                        });
                     }
                  });
               }
            });

            $p = document.createElement("p");
            $p.appendChild($ok);
            contents.push($p);

            w.update(contents);
         }
      });
   }
   refreshRealms();
});

new Module("Fortuna", function( w ){
   var _prizeInfoCache = {};

   function displayMenu( ){
      w.wait();
      GameData.retrieve("player", function( playerData, error ){
         if (error) {
            w.error("Je n’ai pas pu charger player.json",
               error, function( ){ w.close(); });
            return;
         }

         var tickets = playerData.tickets;
         var items = playerData.items;
         var regular = (tickets.fortunas_chance | 0) +
            (items.FortunasTicket | 0);
         var golden = (tickets.gold_club | 0) +
            (items.FortunasGoldenTicket | 0);
         var retention = playerData.retention;
         var contents = [];

         var $h4 = document.createElement("h4");
         $h4.textContent = "C’est pourri, c’est gratuit";
         contents.push($h4);

         var $p = document.createElement("p");
         $p.textContent = "Jour " + retention.length + " sur 7"
         contents.push($p);

         var $ul = document.createElement("ul");
         $ul.id = "fortuna-days";
         var $li;
         var $previous;
         var isCounting = false;
         var hasPlayedThisDay = false;
         for (var i = 8; --i;) {
            $li = document.createElement("li");
            $li.textContent = i;
            hasPlayedThisDay = retention.indexOf(i) >= 0;
            isCounting = isCounting || hasPlayedThisDay;
            var classList = $li.classList;
            if (hasPlayedThisDay) classList.add("fortuna-played-day");
            else if (isCounting) classList.add("fortuna-missed-day");
            if ($previous) $ul.insertBefore($li, $previous);
            else $ul.appendChild($li);
            $previous = $li;
         }
         contents.push($ul);

         if (regular || golden) {
            $ul = document.createElement("ul");
            $ul.classList.add("button-list");
            contents.push($ul);
         } else {
            $p = document.createElement("p");
            $p.textContent = "Plus rien, attendez demain…";
            contents.push($p);
         }

         var s;
         var $button;
         if (regular) {
            s = regular > 1 ? "s" : "";
            $button = createButton(
               regular + " ticket" + s + " simple" + s,
               { onclick: requestGrid }
            );
            $button.setAttribute("data-ticket-type", "regular");
            $li = document.createElement("li");
            $li.appendChild($button);
            $ul.appendChild($li);
         }

         if (golden) {
            s = golden > 1 ? "s" : "";
            $button = createButton( golden + " médaillon" + s, {
               onclick: requestGrid
            });
            $button.setAttribute("data-ticket-type", "golden");
            $li = document.createElement("li");
            $li.appendChild($button);
            $ul.appendChild($li);
         }

         w.update(contents);
      });
   }

   function requestGrid( e, ticketType ){
      ticketType = ticketType || e.target.dataset.ticketType;
      w.wait();

      Ajax.getJson({
         url: Ajax.vars.apiServer + "/minigames/index.json",
         parameters: { ticket_type: ticketType },
         onload: function( r ){
            var json = r.response;
            var timestamp = json.timestamp | 0;
            var prizeList = json.result.prize_list;

            var $heading = document.createElement("h4");
            $heading.textContent = "regular" == ticketType ?
               "Chance de Fortuna" : "Salle des coffres";

            var $table = document.createElement("table");
            $table.id = "fortuna-table";
            var $row;
            var $cell;
            var $img;
            var $span;
            var weightSum = 0;
            for (var i = 0, prize; prize = prizeList[i]; i++) {
               if (!(i % 3)) $row = $table.insertRow(-1);
               $cell = $row.insertCell(-1);

               // TODO weight and weightSum will help to calculate the
               // probability of getting the object(s) the user has
               // beforehand designated
               var weight = prize.weight;
               $cell.setAttribute("data-weight", weight);
               weightSum += weight;

               var type = prize.type;
               $img = document.createElement("img");
               $img.width = 228;
               $img.height = 152;

               $span = document.createElement("span");
               $span.textContent = $img.alt;

               var $div = document.createElement("div");
               $div.appendChild($img);
               $div.appendChild($span);
               $cell.appendChild($div);
               setupPrizeInfo(type, $img, $span);
            }

            var $ok = createButton("Ok", {
               title: "Obtenir un article au hasard dans cette grille",
               onclick: function( ){
                  pick(ticketType, timestamp);
               }
            });
            var $change = createButton("Changer", {
               title: "Demander une nouvelle grille",
               onclick: function( ){
                  requestGrid(null, ticketType);
               }
            });
            var $cancel = createButton("Annuler", {
               title: "Fermer cette fenêtre",
               onclick: function( ){
                  w.close();
               }
            });

            var $ul = document.createElement("ul");
            $ul.classList.add("button-list");
            var $okLi = document.createElement("li");
            $ul.appendChild($okLi);
            $okLi.appendChild($ok);
            var $changeLi = document.createElement("li");
            $ul.appendChild($changeLi);
            $changeLi.appendChild($change);
            var $cancelLi = document.createElement("li");
            $ul.appendChild($cancelLi);
            $cancelLi.appendChild($cancel);

            w.update([$heading, $table, $ul]);
         }
      });
   }

   function setupPrizeInfo( prize, $img, $span ){

      // handle prize texts
      // I added a cache layer because the xml is huge
      if (prize in _prizeInfoCache) {
         var info = _prizeInfoCache[prize];
         $img.alt = info.name;
         $span.textContent = info.name;
         if (info.description) {
            $img.longdesc = info.description;
            $img.title = info.description;
         }
      } else {
         $img.alt = prize;
         $span.textContent = prize;

         GameData.retrieve("langFr", function( data, error ){
            if (error) {
               w.error("Erreur pas trop grave",
                  "Je n'ai pas pu charger le fichier de langue, " +
                  "les objets seront affichés sans traduction.\n" +
                  "(raison\xA0:\n" + error + ")");
               debug(error);
               return;
            }

            // basic XML regexp: ranges include blank characters and
            // all printable ASCII characters (\x20 to \x7E) except
            // `<` (\x3C) and `>` (\x3E) (`=` is \x3D).
            var range = "[\\s\x20-\x3B=\x3F-\x7E]";
            var regexp = new RegExp("<(" + prize.toLowerCase() + ")>\\s*" +
               "(?:<name>(" + range + "*?)</name>\\s*)?" +
               "(?:<description>(" + range + "*?)</description>\\s*)?" +
               "(?:<name>(" + range + "*?)</name>\\s*)?" +
               "</\\1>");
            var match = data.match(regexp);
            var decoded = match && match.map(function( m ) m ?
               m.replace(/&#(\d+);/g, function( _, d )
                  eval("'\\x" + parseInt(d).toString(16) + "'")) :
               "");

            if (decoded) {
               var name = decoded[2] || decoded[4];
               var description = decoded[3] || "";
            } else {
               _prizeInfoCache[prize] = {
                  name       : prize,
                  description: ""
               };
               return;
            }

            $img.alt = name;
            $span.textContent = name;
            $img.longdesc = description;
            $img.title = description;
            $span.title = description;

            _prizeInfoCache[prize] = {
               name       : name,
               description: description
            };
         });
      }

      // handles images
      $img.onerror = function( ){
         debug(prize, this.src);
      };

      var isResource = false;
      var isTroop = false;
      var isStack = false;
      var isChest = false;
      var isGold = false;
      var isEgg = false;
      var chunks = prize.match(/\d+|[A-Z][a-z]*|[a-z]+/g);
      var num;
      var src;
      var dir;
      var chestName;

      chunks.forEach(function( chunk ){
         if (    "K" == chunk) isResource = true;
         if ("Troop" == chunk) isTroop = true;
         if ("Stack" == chunk) isStack = true;
         if ("Chest" == chunk) isChest = true;
         if ( "Gold" == chunk) isGold = true;
         if (  "Egg" == chunk) isEgg = true;
         if (   !isNaN(chunk)) num = chunk;
      });
      if (isTroop && !isStack) {
         dir = "troops/";
         src = chunks.slice(0, chunks.indexOf(num)).join("");
      } else {
         dir = "item/";
         if (isResource) {
            if (isGold) src = "gold";
            else        src = chunks[0].toLowerCase();
         } else if (isChest) {
            dir = "";
            chestName = "configurablechest" + num;
            src = "item/configurablechest"; // default image
            GameData.retrieve("chests", function( data, error ){
               if (error) {
                  w.error("Erreur pas trop grave",
                     "Je n'ai pas pu charger les images des coffres, " +
                     "ils auront tous l’image par défaut.\n" +
                     "(raison\xA0:\n" + error + ")");
                  return;
               }
               if (prize in data) {
                  src = data[prize].replace(/\.jpg$/, "");
                  // immediately updates $img.src in case “chest” data
                  // are already in memory
                  $img.src = Ajax.vars.assetsServer +
                     "/flash/assets/" + dir + src + ".jpg";
               }
            });
         } else if (isEgg) {
            var eggType = chunks[1].toLowerCase();
            if ("mephitic" == eggType) eggType = "swamp";
            if (   "helio" == eggType) eggType = "desert";
            if ("dragon" == eggType) eggType = chunks[0].toLowerCase();
            src = eggType + "dragonegg";
         } else if (isStack) {
            src = chunks.slice(0, chunks.indexOf("Stack"))
               .join("").toLowerCase();
         } else {
            src = chunks.join("").toLowerCase();
         }
      }
      $img.src = Ajax.vars.assetsServer +
         "/flash/assets/" + dir + src + ".jpg";
   }

   function pick( ticketType, timestamp ){
      w.wait();
      Ajax.signedPost({
         url: Ajax.vars.apiServer +
            "/minigames/save_result.json",
         responseType: "json",
         parameters: {
            ticket_type: ticketType,
            minigame_timestamp: timestamp
         },
         onerror: function( r ){
            debug(r);
            w.error("Erreur de connexion", "", function( ){
               displayMenu();
            });

         },
         onload: function( r ){
            var result = r.response.result;
            if (!result.success) {
               w.error("Erreur du serveur", result.reason, function( ){
                  displayMenu();
               });
               return;
            }

            GameData.update("player");

            var prizeType = result.item_won.type;

            var $img = document.createElement("img");
            var $span = document.createElement("span");
            setupPrizeInfo(prizeType, $img, $span);

            var $h4 = document.createElement("h4");
            $h4.textContent = "Vous avez gagné\xA0:";

            var $p = document.createElement("p");
            $p.id = "fortuna-prize";
            $p.appendChild($img);
            $p.appendChild($span);

            var $okP = document.createElement("p");
            var $button = createButton("Continuer", {
               onclick: displayMenu
            });
            $okP.appendChild($button);

            w.update([$h4, $p, $okP]);
         }
      });
   }

   displayMenu();
});

new Module("Map", function( w ){
   w.wait();

   var MAP_WIDTH = 750;
   var MAP_HEIGHT = 750;
   var MAP_HEADER_LENGTH = 2;
   var MAP_TYPES = [
      "CAPITAL_CITY",    // 0
      "PLAIN",           // 1
      "MOUNTAIN",        // 2
      "FOREST",          // 3
      "HILL",            // 4
      "GRASSLAND",       // 5
      "LAKE",            // 6
      "BOG",             // 7
      "ANTHROPUSCAMP",   // 8
      "FOG"              // 9
   ];

   var SPRITE_WIDTH = 150; // pixels
   var SPRITE_HEIGHT = 100;

   var CANVAS_WIDTH = 400;
   var CANVAS_HEIGHT = 300;

   // POST {apiServer}/map.json ? x, y
   // => json {
   //    x           : integer
   //    y           : integer
   //    map_cities  : [{
   //       id             player id
   //       name           player name
   //       race           player race
   //       level          player level
   //       might          player might
   //       alliance_name  player alliance
   //       map_player_id  city id?
   //       x              position x
   //       y              position y
   //       type           city/outpost type
   //       healing        whether outpost is healing or not
   //    }, …]
   // }

   // no need to synchronise sprite sheet loading since it's local
   var $spriteSheet = new Image();
   $spriteSheet.src = GM_getResourceURL("terrains");

   // needs "map" for static map data and "player" for inital position
   // and owned wildernesses
   GameData.retrieveMulti(["map", "player"], function( data, errors ){
      debug(data);
      var map = data.map;
      var player = data.player;
      var err;
      if (!map) {
         err = errors.map;
         w.error("Map Data Error: " + err.name,
            err.message + " " + err.fileName + ":" + err.lineNumber,
            function( ){ w.close(); });
      } else if (!player) {
         err = errors.player;
         w.error("Player Data Error: " + err.name,
            err.message + " " + err.fileName + ":" + err.lineNumber,
            function( ){ w.close(); });
      }

      var $form = document.createElement("form");

      var $h4 = document.createElement("h4");
      $h4.textContent = "Coordonnées…";
      $form.appendChild($h4);

      var $p = document.createElement("p");
      $form.appendChild($p);

      var $label = document.createElement("label");
      $label.textContent = "x ";
      $p.appendChild($label);

      var $xInput = document.createElement("input");
      $xInput.type = "number";
      $xInput.min = 0;
      $xInput.max = MAP_WIDTH;
      $xInput.step = 1;
      $xInput.size = 3;
      $xInput.value = player.cities.capital.x;
      $label.appendChild($xInput);

      $p.appendChild(document.createTextNode(" / "));

      $label = document.createElement("label");
      $label.textContent = "y ";
      $p.appendChild($label);

      var $yInput = $xInput.cloneNode();
      $yInput.max = MAP_HEIGHT;
      $yInput.value = player.cities.capital.y;
      $label.appendChild($yInput);

      $label = document.createElement("label");
      $label.textContent = "zoom ";

      var $zoomInput = $xInput.cloneNode();
      $zoomInput.max = 1;
      $zoomInput.size = 4;
      $zoomInput.step = 0.05;
      $zoomInput.value = 1;
      $label.appendChild($zoomInput);

      $p = document.createElement("p");
      $p.appendChild($label);
      $form.appendChild($p);
      
      $h4 = document.createElement("h4");
      $h4.textContent = "Override";
      $form.appendChild($h4);
      
      $p = document.createElement("p");
      $form.appendChild($p);
      
      var $nInput = $xInput.cloneNode();
      $nInput.max = 9;
      $nInput.size = 1;
      $nInput.value = 1;
      $label = document.createElement("label");
      $label.textContent = "n ";
      $label.appendChild($nInput);
      $p.appendChild($label);
      
      var $mInput = $xInput.cloneNode();
      $mInput.max = 20;
      $mInput.size = 2;
      $mInput.value = 1;
      $label.appendChild($mInput);
      $label = document.createElement("label");
      $label.textContent = " m ";
      $label.appendChild($mInput);
      $p.appendChild($label);

      var $submit = document.createElement("input");
      $submit.type = "submit";
      $submit.classList.add("button");
      $submit.value = "Voir";

      $p = document.createElement("p");
      $p.appendChild($submit);
      $form.appendChild($p);

      var $canvas = document.createElement("canvas");
      $canvas.width = CANVAS_WIDTH;
      $canvas.height = CANVAS_HEIGHT;
      var buffer = new Uint8Array(map);

      /**
       * Calculates the offset x, y pixel values within the sprite sheet
       * to display the terrain located at the (u, v) coordinates.
       * @param u       
       * @param v       
       */
      function calculateSpriteOffset( u, v ){
         var byte = buffer[MAP_HEADER_LENGTH + MAP_HEIGHT * u + v];
         var type = byte >> 4 % 16;
         var level = byte % 16;
         var spriteLevel = 10 == level ? 2 :
            Math.floor((level - 1) / 3);
         return {
            x: SPRITE_WIDTH * (type - 1), // - 1 because 0 = city
            y: SPRITE_HEIGHT * spriteLevel
         };
      }
   
      /**
       * Draws a region of the map around the given (u, v) point
       * into a canvas.
       * @param cx   the canvas' 2d context
       * @param uO   map x coordinate of the center tile
       * @param vO   map y coordinate of the center tile
       * @param p    zoom percentage
       */
      function drawRegion( cx, uO, vO, p ){
         // aliases for shorter formulae
         var W = CANVAS_WIDTH;
         var H = CANVAS_HEIGHT;
         var w = SPRITE_WIDTH;
         var h = SPRITE_HEIGHT;
         
         cx.clearRect(0, 0, W, H);

         var n = Math.ceil(W / (2 * w * p));
         var m = Math.ceil(H / (2 * h * p));

         // debug("n =", n, ", m =", m);

         // OVERRIDE
         n = $nInput.value | 0;
         m = $mInput.value | 0;
         
         
         var x; // sprite x on the canvas
         var y; // sprite y on the canvas
         var u; // sprite x on the map
         var v; // sprite y on the map
         
         // centered axis
         cx.strokeStyle = "rgba(255, 255, 255, 0.2)";
         cx.lineWidth = 1;
         cx.beginPath();
         cx.moveTo(0, H/2 + 0.5);
         cx.lineTo(W, H/2 + 0.5);
         cx.moveTo(W/2 + 0.5, 0);
         cx.lineTo(W/2 + 0.5, H);
         cx.stroke();
         
         for (var i = -n; i <= +n; i++) {
            for (var j = -m; j <= +m; j++) {
               u = (uO + i) % MAP_WIDTH;
               if (u < 0) u += MAP_WIDTH;
               v = (vO + j) % MAP_HEIGHT;
               if (v < 0) v += MAP_HEIGHT;
               var so = calculateSpriteOffset(u, v);
               x = w * p * (i + j) / 2 + (W - w * p) / 2;
               y = h * p * (i - j) / 2 + (H - h * p) / 2;
               
               cx.drawImage($spriteSheet,
                  so.x, so.y,
                  w, h,
                  x, y,
                  w * p, h * p);

               // void drawImage(
               //   in nsIDOMElement image,  source image
               //   in float sx,             source top left x
               //   in float sy,             source top left y
               //   in float sw,             source width   (clipping)
               //   in float sh,             source height  (clipping)
               //   in float dx,             destination x
               //   in float dy,             destination y
               //   in float dw,             destination width  (scaling)
               //   in float dh              destination height (scaling)
               // );
               
            }
         }
      }
      
      function draw( ){
         if (!$canvas.parentNode) {
            $form.appendChild($canvas);
            w.center();
         }
         drawRegion(
            $canvas.getContext("2d"),
            parseInt($xInput.value, 10) | 0,
            parseInt($yInput.value, 10) | 0,
            parseFloat($zoomInput.value) || 1
         );
      }

      $form.addEventListener("submit", function( event ){
         event.preventDefault();
         draw();
      });
      
      $canvas.onwheel = function( event ){
         event.preventDefault();
         var p = ($zoomInput.value = parseFloat($zoomInput.value) || 1)
         // multiplies by 100 to avoid floating point deviations
         p = Math.round(p * 100);
         if (event.deltaY > 0) {
            p = Math.max(25, p - 5);
         } else if (event.deltaY < 0) {
            p = Math.min(200, p + 5);
         }
         $zoomInput.value = p / 100;
         draw();
      };

      // Ajax.signedPost({
      //  url: Ajax.vars.apiServer + "/map.json",
      //  responseType: "json",
      //  parameters: {
      //     x: x,
      //     y: y,
      //     width: width,
      //     height: height
      //  },
      //  onload: function( response ){
      //     // TODO
      //     debug(response);
      //  },
      //  onerror: function( error ){
      //     debug(error.relatedData);
      //     w.error("Oups", error, function( ){ w.close(); });
      //  }
      // });

      w.update($form);
   });
});

new Module("Trainings", function( w ){
   w.$window.id = "trainings";
   w.wait();

   Ajax.getJson({
      url: Ajax.vars.apiServer + "/player/jobs.json",
      onload: function( r ){
         var earlyResult = r.response.result;
         if (!earlyResult.success) {
            w.error("Erreur",
               "Le serveur n'a pas renvoyé de résultat.",
               function( ){ w.close(); });
            return;
         }
         if ("false" === earlyResult.success) {
            w.error("Erreur du serveur",
               earlyResult.reason || "Pas d'explication…",
               function( ){ w.close(); });
            return;
         }

         var cities = earlyResult.result;
         var contents = [];
         var total = {};
         var $table = document.createElement("table");
         for (let cityName in cities) {
            let $tbody;
            let $cityFirstRow;
            let cityRowCount = 0;
            cities[cityName].forEach(function( job ){
               if ("units" !== job.queue) return;

               if (!$tbody) {
                  $tbody = document.createElement("tbody");
                  $table.appendChild($tbody);
               }

               var unit = job.unit_type;
               var quantity = job.quantity;
               var $row = $tbody.insertRow(-1);
               if (!$cityFirstRow) $cityFirstRow = $row;
               $row.insertCell(-1).textContent = unit;
               $row.insertCell(-1).textContent = quantity;
               $row.insertCell(-1).textContent =
                  new Date(job.run_at * 1e3).toShortFormat();
               $row.insertCell(-1).textContent =
                  job.duration.toTimeInterval();

               cityRowCount++;
               total[unit] = (total[unit] || 0) + quantity;
            });
            if ($tbody) {
               let $cityNameCell = document.createElement("th");
               $cityNameCell.textContent = cityName;
               $cityNameCell.rowSpan = cityRowCount;
               $cityFirstRow.insertBefore($cityNameCell,
                  $cityFirstRow.firstChild);
            }
         }
         if ($table) {
            let $headRow = $table.createTHead().insertRow(-1);
            $headRow.insertCell(-1).textContent = "Lieu";
            $headRow.insertCell(-1).textContent = "Unité";
            $headRow.insertCell(-1).textContent = "Quantité";
            $headRow.insertCell(-1).textContent = "Fin prévue";
            $headRow.insertCell(-1).textContent = "Durée";
            // let $h4 = document.createElement("h4");
            // $h4.textContent = cityName;
            // contents.push($h4);
            contents.push($table);
         }

         var $pre = document.createElement("pre");
         $pre.textContent = JSON.stringify(total);
         contents.push($pre);

         w.update(contents);
      }
   });
});

// [@DAT] Game Data ////////////////////////////////////////////////////

var GameData = (function( ){
   var _cache = {};

   var _keys = {
      player: {
         url: "{apiServer}/player.json",
         loadMethod: "getJson"
      },
      chests: {
         url: "{assetsServer}/flash/assets/item/thumbnails.json?b={lazyLoadedSwfCachebreaker}",
         loadMethod: "getJson"
      },
      manifest: {
         url: "{apiServer}/manifest.json",
         loadMethod: "getJson"
      },
      map: {
         url: "{assetsServer}{assetsPrefix}/map.bin?b={mapBinCachebreaker}",
         loadMethod: "getBinary"
      },
      langFr: {
         url: "{apiServer}/locales/fr.xml",
         loadMethod: "getXml"
      }
   };

   return {
      retrieve: function retrieve( key, callback ){
         if (key in _cache) {
            if (callback) callback(_cache[key]);
            return;
         }

         var handler = _keys[key];
         if (!handler.pendingRequests) handler.pendingRequests = [];
         if (!handler.pendingRequests.length) {
            Ajax[handler.loadMethod](Object.extend(handler.options, {
               url: handler.url.replace(/\{([^\}]+)\}/g,
                  function( _, varName ) Ajax.vars[varName]),

               onload: function( response ){
                  var data = response.response;
                  _cache[key] = data;
                  expose(data, key);
                  window.dispatchEvent(
                     new CustomEvent(key + "Loaded", {
                        bubbles: false,
                        cancelable: false,
                        detail: { data: data }
                     }));
                  var request;
                  while (request = handler.pendingRequests.pop())
                     request(data);
               },

               onerror: function( error ){
                  var request;
                  while (request = handler.pendingRequests.pop())
                     request(null, error);
               }
            }));
         }
         handler.pendingRequests.push(callback);
      },

      retrieveMulti: function retrieveMulti( keys, callback ){
         var requirementsCount = keys.length;
         var multiData = {};
         var multiError = {};

         function decreaseAndCheck( ){
            if (!--requirementsCount) callback(multiData, multiError);
         }

         keys.forEach(function( key ){
            GameData.retrieve(key, function( data, error ){
               multiData[key] = data;
               multiError[key] = error;
               decreaseAndCheck();
            });
         });
      },

      update: function update( key, newData ){
         if (!newData) {
            delete _cache[key];
            GameData.retrieve(key);
            return;
         }
         var data = _cache[key];
         if (!data) return;
         for (var name in newData) data[name] = newData[name];
      },

      isLoaded: function isLoaded( key ){
         return key in _cache;
      }
   };
}());

// [@INI] Script Initialization ////////////////////////////////////////

// initializes the flash object--yes, the one that shoudn't exist
// anymore… Only call this function after `Ajax.vars` has been populated
function initSwf( $swf ){
   var $flashvars = $swf.querySelector("param[name=flashvars]");

   var overrideVars = {
      width: window.innerWidth,
      height: window.innerHeight,
      paymentExtra: "sblarff:" // nonexistent protocol
      // note: set `paymentExtra` to "javascript:" to see interesting
      // bugs ^_^
   };
   for (var v in overrideVars) Ajax.vars[v] = overrideVars[v];

   // filters the vars before passing them in as flashvars
   [
      // API and content servers
      "api_server",
      "s3_server",
      "s3_swf_prefix",

      // player identifiers
      "session_id",
      "user_id",
      "dragon_heart",

      // lang
      "locale",

      // social networks
      "facebook_id",
      "viral",

      // visual parameters
      "width",
      "height",
      "canvas_bgcolor",

      // chat
      "pub_server",
      "pub_port",
      "user_time",

      // cachebreakers
      "primary_ui_cachebreaker",
      "secondary_ui_cachebreaker",
      "building_cachebreaker",
      "sound_cachebreaker",
      "client_cachebreaker",
      "lazy_loaded_swf_cachebreaker",
      "map_bin_cachebreaker",

      // CDN
      "mode_is_cdn",
      "preloader_url",
      "ruby_store_url",
      "assets_server",
      "assets_prefix",
      "statics_server",

      // advertising
      "payment_extra",

      // ?
      "platform",
      "subnetwork",
      "user_hash",
   ].forEach(function( name ){
      var value = Ajax.vars[name.replace(/_(\w)/gi,
         function( s, s1 ){ return s1.toUpperCase(); })];
      $flashvars.value += name + "=" + value + "&";
   });
   var v = $flashvars.value;
   $flashvars.value = v.substr(0, v.length - 1);

   if (Ajax.vars.modeIsCdn) {
      $swf.data = Ajax.vars.preloaderUrl;
   } else {
      $swf.data = Ajax.vars.assetsServer + Ajax.vars.assetsPrefix +
         "/preloader.swf?cachebreaker=" +
         Ajax.vars.preloaderCachebreaker;
   }
}

function injectStyle( style ){
   var $receiver = document.querySelector("head") ||
      document.documentElement;
   var $style = document.createElement("style");
   $style.type = "text/css";
   $style.textContent = style;
   $receiver.appendChild($style);
}

switch (currentHost) {

case "kabam": ///////////////////////////////////////////////////////

   document.title = "HybriDoA";

   // rejection of marketing cookies
   document.cookie =
      "eu_privacy_consent=false; path=/; domain=kabam.com";

   // script prevention: Firefox only. This is not vital but saves
   // a lot of processing and useless network traffic.
   document.addEventListener("beforescriptexecute", function( e ){
      e.preventDefault();
   });

   document.addEventListener("DOMContentLoaded", function( ){
      stop();

      var $body = document.body;
      var $html = document.documentElement;
      var $form = document.getElementById("post_form");

      // DOM nodes saving
      var $saver = document.createElement("div");
      $saver.appendChild($form);

      // HTML cleaning
      Array.forEach(
         $html.querySelectorAll("script, style, link[rel=stylesheet]"),
         function( $ ){ $.parentNode.removeChild($); }
      );
      Attribute.removeAll($html, "lang", "dir");
      $body.innerHTML = "";
      Attribute.removeAll($body);

      // DOM repopulation
      injectStyle("html, body, iframe {\
         display: block;\
         width: 100%;\
         height: 100%;\
         margin: 0;\
         border: none;\
         overflow: hidden;\
         background: black;\
      }\
      iframe {\
         opacity: 0;\
         transition: opacity 0.4s ease-in;\
      }");

      $body.appendChild($form);

      var $iframe = document.createElement("iframe");
      $iframe.src = "#";
      $iframe.width = window.innerWidth;
      $iframe.height = window.innerHeight;
      $iframe.onload = function( ){ this.style.opacity = "1"; };
      $body.appendChild($iframe);

      // game launching
      $form.target = $iframe.name = "hybridoa-iframe";
      $form.submit();

   });
   break;

case "wonderhill": //////////////////////////////////////////////////

   if (FIREFOX) {
      // prevents scripts and retrieves `C.attrs` values
      document.addEventListener("beforescriptexecute", function( e ){
         e.preventDefault();
         var source = e.target.textContent;
         if (source.indexOf("C.attrs") >= 0) Ajax.initVars(source);
      }, false);
   }

   document.addEventListener("DOMContentLoaded", function( ){
      var $html = document.documentElement;
      var $body = document.body;
      $body.onload   = "";
      $body.onresize = "";

      if (!FIREFOX) {
         // Non Firefox browsers: scripts haven't been prevented
         // by `beforescriptexecute`, we need to work on it…

         // V6 is a Rube Goldberg machine, this prevents its loading
         unsafeWindow.V6.go = function( ){};

         // redefines the `platforms_kabam_game_show` function, which is
         // called just after the `C.attrs` variables have been
         // populated. This allows to retrieve these variables and at
         // the same time to prevent the Flash from loading.
         var C = unsafeWindow.C;
         C.views.platforms_kabam_game_show = function( ){
            Ajax.initVars(C.attrs);
         };
      }

      // cleans up the HTML
      Attribute.removeAll($html, "xmlns");
      $html.lang = "fr";
      $html.setAttribute("xml:lang", "fr-FR");
      $body.innerHTML = "";
      Attribute.removeAll($body);
      Array.forEach(document.querySelectorAll(
            "style, link[type='text/css'], script"),
         function( $ ){ $.parentNode.removeChild($); });

      // inserts the new content
      injectStyle(GM_getResourceText("style"));

      var $html = document.documentElement;
      var $body = document.body;

      $body.innerHTML = GM_getResourceText("html");
      var $controls = document.getElementById("controls");
      var $swf = document.getElementById("swf");

      function stopFlash( ){
         var $parent = $swf.parentNode;
         if ($parent) $parent.removeChild($swf);
      }

      // Flash control buttons
      var $startButton = document.getElementById("start-button");
      var flashLoaded = false;

      // timer to stop the Flash when Cassandra shows up
      var cassandraTimer;
      var CASSANDRA_DELAY = 420 * 1000;
      window.addEventListener("mousemove", function( e ){
         clearTimeout(cassandraTimer);
         cassandraTimer = setTimeout(stopFlash, CASSANDRA_DELAY);
      });

      $startButton.addEventListener("click", function( event ){
         event.preventDefault();

         clearTimeout(cassandraTimer);
         cassandraTimer = setTimeout(stopFlash, CASSANDRA_DELAY);

         this.textContent = "…";
         var that = this;
         setTimeout(function( ){ that.textContent = "Restart"; }, 2000);

         if (!flashLoaded) {
            initSwf($swf);
            $body.insertBefore($swf, $body.firstChild);

            var previousResize = 0;
            var timer = -1;
            var $html = document.documentElement;
            var resize = function resize( ){
               clearTimeout(timer);
               var now = Date.now();
               if (now - previousResize >= 1000) {
                  var controlsStyle = getComputedStyle($controls, null);
                  var controlsHeight = parseInt(controlsStyle.height) +
                     parseInt(controlsStyle.borderTopWidth);
                  var height = $html.clientHeight - controlsHeight;
                  $swf.height = height;
                  $swf.width = Math.min(height * 1.3,
                     $html.clientWidth);
               } else {
                  timer = setTimeout(resize, 1000);
               }
               previousResize = now;
            }
            window.addEventListener("resize", resize);
            resize();

            flashLoaded = true;
         } else {
            stopFlash();
            setTimeout(function( ){
               $body.insertBefore($swf, $body.firstChild);
            }, 700);
         }
      });

      var $stopButton = document.getElementById("stop-button");
      $stopButton.addEventListener("click", function( event ){
         event.preventDefault();
         stopFlash();
      });

      Module.initAll();
   }, false);

   break;

}

// [@AJX] Ajax Primitives //////////////////////////////////////////////

var VERSION = "overarch";
var DORSAL_SPINES = "LandCrocodile";
var LEVIATHON = "Bevar-Asp";
var DRACO = "Draoumculiasis";

var Ajax = {
   vars: {},

   // initializes the variables from the source code of the script
   // containing the `C.attrs` declarations, or from the `C.attrs`
   // object itself
   initVars: function( source ){
      var vars = {};
      if ("string" == typeof source) { // `source` is the source code
         var regexp = /^\s*C\.attrs\.(\w+)\s+=\s*([^;$]+)/gm;
         //                C .attrs .( 1 )   =   (  2   )
         var match;
         while (match = regexp.exec(source)) {
            // the try/catch blocks prevents an error because of
            // incorrect labels in `googlePaymentTokens`
            try {
               vars[match[1]] = eval(match[2]);
            } catch (_) {}
         }
      } else { // `source` is `C.attrs`
         for (var attr in source) if (source.hasOwnProperty(attr))
            vars[attr] = source[attr];
      }

      Ajax.vars = vars;

      expose(vars, "ajaxvars");
   },

   // timestamp format in seconds used by the game
   getTimestamp: function getTimestamp( ) "" + (new Date() / 1000 | 0),

   // the parameters required by every request to Wonderhill
   get mandatoryParameters( ) ({
      "_session_id" : Ajax.vars.sessionId,
      "dragon_heart": Ajax.vars.dragonHeart,
      "user_id"     : Ajax.vars.userId,
      "version"     : VERSION,
      "timestamp"   : Ajax.getTimestamp()
   }),

   // transforms an object into an URL parameters string
   serialize: function serialize( object ){
      var chunks = [];
      for (var prop in object) {
         chunks.push(encodeURIComponent(prop) + "=" +
            encodeURIComponent(object[prop]));
      }
      return chunks.join("&");
   },

   // default error handling method
   error: function error( message ){
      console.error(this, message);
   },

   /** Low level Ajax method: every other methods use this one
   * @param {object} options
   *  an object that may contain:
   *            method  (required) the HTTP method ("post" or "get")
   *
   *               url  (required) the request URL
   *
   *        parameters  an object containing the request parameters
   *
   *              data  the parameters string
   *                    (if specified, parameters will be ignored)
   *
   *           headers  an object containing additionnal headers
   *
   *      responseType  the expected response type
   *                    ("arraybuffer" or "json" or "text")
   *
   *  overrideMimeType  a MIME type to override
   *
   *            onload  the function to call in case of success
   *
   *        onprogress  the function to call upon each packet receipt
   *
   *           onerror  the function to call in case of error
   *
   * Important:
   * the parameter to be passed with callback functions is based on the
   * XMLHttpRequest level 2 standard. Especially, it provides a
   * `response` property which's type depends on `responseType`. Thus,
   * callback function don't need to process `responseText` if the
   * correct `responseType` has been required.
   */
   request: function request( options ){
      var method = options.method.toLowerCase();
      var url = options.url;
      var data = options.data || Ajax.serialize(Object.extend(
         options.parameters, Ajax.mandatoryParameters));
      if ("get" == method) url += "?" + data;
      var headers = options.headers || {};

      var nop = function( ){};
      var onprogress = options.onprogress || nop;
      var onerror = options.onerror || Ajax.error;

      if (USE_GM_XHR) {

         var gmOptions = {
            method    : method,
            url       : url,
            headers   : headers,
            onprogress: onprogress,
            onerror   : onerror
         };
         if ("post" == method) gmOptions.data = data;

         if (options.onload) switch (options.responseType) {

            case "arraybuffer":
               // specifies an unknown charset on purpose, so that the
               // browser doesn't transform binary data
               gmOptions.overrideMimeType =
                  "text/plain; charset=x-user-defined";
               gmOptions.onload = Ajax.switchCallback(function( r ){
                     var text = r.responseText;
                     var buffer = new ArrayBuffer(text.length);
                     var bytes = new Uint8Array(buffer);
                     for (var i = text.length; i--;)
                        bytes[i] = text.charCodeAt(i) & 0xff;
                     // TODO
                     // this processing is potentially long
                     // (the "map.bin" file is about 550 Ko)
                     // => consider using a Web Worker?

                     var tweakedResponse = Object.extend({
                        response: buffer
                     }, r);
                     options.onload.call(this, tweakedResponse);
                  }, options.onerror);
               break;

            case "json":
               gmOptions.onload = Ajax.switchCallback(function( r ){
                     try {
                        var tweakedResponse = Object.extend({
                           response: JSON.parse(r.responseText)
                        }, r);
                        options.onload.call(this, tweakedResponse);
                     } catch (error) {
                        error.relatedData = r;
                        (options.onerror || Ajax.error).call(this, error);
                     }
                  }, options.onerror);
               break;

            case "text":
            case "xml":
            default:
               gmOptions.onload = Ajax.switchCallback(function( r ){
                     var tweakedResponse = Object.extend({
                        response: r.responseText
                     }, r);
                     options.onload.call(this, tweakedResponse);
                  },
                  options.onerror
               );

         }

         if (options.overrideMimeType)
            gmOptions.overrideMimeType = options.overrideMimeType;
         GM_xmlhttpRequest(gmOptions);

      } else {
         debug("using native XMLHttpRequest");

         var url = options.url + "get" == method ? "?" + data : "";

         var broker = new XMLHttpRequest();
         broker.open(method, url);

         if ("post" == method)
            headers["content-type"] = "application/x-www-form-encoded";

         for (var header in headers)
            broker.setRequestHeader(header, headers[header]);
         broker.responseType = options.responseType || "";
         if (options.overrideMimeType)
            broker.overrideMimeType(options.overrideMimeType);

         broker.onload = options.onload || nop;
         broker.onprogress = options.onprogress || nop;
         broker.onerror = options.onerror || Ajax.error;

         broker.send("post" == method ? data : null);

      }
   },

   switchCallback: function switchCallback( onsuccess, onerror ){
      return function( response ){
         if (200 == response.status) onsuccess(response);
         else (onerror || Ajax.error)(response);
      };
   },

   get: function get( options ){
      options.method = "get";
      Ajax.request(options);
   },

   getJson: function getJson( options ){
      options.responseType = "json";
      Ajax.get(options);
   },

   getBinary: function getBinary( options ){
      options.responseType = "arraybuffer";
      Ajax.get(options);
   },

   getXml: function getXml( options ){
      // DoA XML files aren't well formed so I treat it as text
      options.overrideMimeType = "text/plain";
      Ajax.get(options);
   },

   post: function post( options ){
      options.method = "post";
      Ajax.request(options);
   },

   signedPost: function signedPost( options ){
      var data = options.data || Ajax.serialize(
         Object.extend(options.parameters, Ajax.mandatoryParameters));
      options.data = data;
      var phrase =
         DRACO + data + DORSAL_SPINES + options.url + LEVIATHON;
      var sig = SHA1(phrase);
      options.headers = Object.extend(options.headers, {
         "Content-length": data.length,
         "Content-type": "application/x-www-form-urlencoded",
         "X-S3-AWS": sig
      });
      Ajax.post(options);
   }

};

// [@SHA] A JavaScript Implementation of Sha-1 /////////////////////////

var SHA1 = (function( ){

   function rotateLeft32( x, n ){
      return (x << n) | (x >>> 32 - n);
   }

   function add32( ){
      var sum = 0;
      for (var i = 0, l = arguments.length; i < l; i++) {
         sum = sum + arguments[i] & 0xffffffff;
      }
      return sum;
   }

   function Ch( x, y, z ){
      return (x & y) | (~x & z);
   }

   function Parity( x, y, z ){
      return x ^ y ^ z;
   }

   function Maj( x, y, z ){
      return (x & y) | (x & z) | (y & z);
   }

   function f( t ){
      if (t < 20) return Ch;
      if (t < 40) return Parity;
      if (t < 60) return Maj;
      return Parity;
   }

   function K( t ){
      if (t < 20) return 0x5a827999;
      if (t < 40) return 0x6ed9eba1;
      if (t < 60) return 0x8f1bbcdc;
      return 0xca62c1d6;
   }

   function SHA1( message ){
      var ascii = unescape(encodeURIComponent(message));
      var length = ascii.length;
      var bitLength = length * 8 & 0xffffffff;
      var mod = length % 64;
      var padding = (mod <= 55) ? 55 - mod : 119 - mod;
      var buffer = new Uint32Array(
            new ArrayBuffer(length + 9 + padding));
      var bufferLength = buffer.length;
      var M = [];
      var i, offset, shift, t, N;
      var W = new Uint32Array(new ArrayBuffer(320));
      var H = new Uint32Array([
            0x67452301,
            0xefcdab89,
            0x98badcfe,
            0x10325476,
            0xc3d2e1f0
         ]);
      var u = new Uint32Array(6);

      for (i = 0, offset = 0, shift = 24;
            i < length;
            i++, offset = i/4 | 0, shift = (shift + 24) % 32) {
         buffer[offset] |= ascii.charCodeAt(i) << shift;
      }
      buffer[offset] |= 0x80 << shift;
      buffer[bufferLength - 1] = bitLength & 0xffffffff;

      for (i = 0; i < bufferLength; i += 16) {
         M.push(buffer.subarray(i, i + 16));
      }

      N = M.length;

      for (i = 1; i <= N; i++) {
         for (t = 0; t <= 15; t++)
            W[t] = M[i-1][t];
         for (; t <= 79; t++)
            W[t] = rotateLeft32(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16], 1);

         u[0] = H[0];
         u[1] = H[1];
         u[2] = H[2];
         u[3] = H[3];
         u[4] = H[4];

         for (t = 0; t <= 79; t++) {
            u[5] = add32(rotateLeft32(u[0], 5), f(t)(u[1], u[2], u[3]),
               u[4], K(t), W[t]);
            u[4] = u[3];
            u[3] = u[2];
            u[2] = rotateLeft32(u[1], 30);
            u[1] = u[0];
            u[0] = u[5];
         }

         H[0] = add32(u[0], H[0]);
         H[1] = add32(u[1], H[1]);
         H[2] = add32(u[2], H[2]);
         H[3] = add32(u[3], H[3]);
         H[4] = add32(u[4], H[4]);

      }

      var resultString = "";
      var s;
      for (i = 0; i < 5; i++) {
         s = H[i].toString(16);
         resultString += new Array(9 - s.length).join("0") + s;
      }
      return resultString;
   }

   return SHA1;
}());
