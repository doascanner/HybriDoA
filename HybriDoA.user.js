// ==UserScript==
// @name          HybriDoA
// @namespace     fr.kergoz-panik.watilin
// @version       0.0
// @description   Projet de remplacer le SWF par du pur HTML5/JavaScript
// 
// @include       https://www.kabam.com/fr/games/dragons-of-atlantis/play*
// @match         https://*.castle.wonderhill.com/platforms/kabam/*
// @exclude       *?gm=no*
// @exclude       *&gm=no*
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

Ce script est actuellement une ÉBAUCHE. Il me sert à tester la
faisabilité de mes objectifs. Il comporte des fonctionnalités qui ne
marchent pas ou sont incompréhensibles, et peut-être même des failles
de sécurité. NE L'INSTALLEZ PAS à moins que vous vouliez suivre mon
travail ou vous en inspirer.

This script is currently a DRAFT. I’m using it to test the feasability
of my goals. It includes defective or incomprehensible features, and
perhaps even security flaws. DO NOT INSTALL IT unless you want to follow
up my work or get inspired by it.
*/

/* Marqueurs :
   todo, xxx, here, i18n, temp
*/

/* TODO
Vues
   - une vue de la ville principale (bâtiments & niveaux)
   - une vue de la carte (terrains & propriétaires)
   - liste des jobs
   - une vue des champs de la ville principale
   - une vue de chaque avant-poste (champs & cité)
   
Actions
   - construction/amélioration de bâtiments
   - lancement de marches
   - entraînement de troupes
   - recherches
   
Messages
   - consultation des anciennes pages
   - suppression
   
Alliance
   (à définir)
   
Automatisation
   (à définir)
   
Script
   - gestion des raccourcis clavier
   - i18n

Style
   - 
*/

/* Sommaire

Les sections sont étiquetées avec un arobase (@). Utilisez la
fonction recherche pour naviguer entre les sections. Par exemple,
pour la section [XYZ], tapez « @XYZ ».
  [NAV] Détection du navigateur
  [DBG] Utilitaires de débogage
  [UTI] Divers utilitaires
  [WIN] Constructeur Window
  [MOD] Modules
  [INI] Initialisation du script
  [AJX] Primitives Ajax
  [SHA] Implémentation JavaScript du Sha-1
*/

"use strict";

// [@NAV] Détection du navigateur //////////////////////////////////////

var ua = navigator.userAgent;
const FIREFOX = ua.search(/firefox/i) >= 0;

// passer à false quand on aura pu se débarasser de GM_xmlhttpRequest
const USE_GM_XHR = true;

// [@DBG] Utilitaires de débogage //////////////////////////////////////

// affiche l'objet dans la console disponible
var debug = (function( ){
   var c = unsafeWindow.console || console;
   if (c) return c.debug || c.log;
   
   var $console;
   var firstLogs = [];
   var isInserted = false;
   $console = document.createElement("pre");
   $console.id = "console";
   document.addEventListener("DOMContentLoaded", function( ){
      document.body.appendChild($console);
      isInserted = true;
      firstMessages.forEach(function( message ){ debug(message); });
   }, false);
   
   function debug( message ){
      if (isInserted) {
         var $message = document.createElement("div");
         var $time = document.createElement("time");
         var $child = $console.firstChild;
         $time.textContent = new Date().toLocaleTimeString();
         $message.appendChild($time);
         $message.appendChild(document.createTextNode(message));
         if ($child) $console.insertBefore($message, $child);
         else $console.appendChild($message);
      } else {
         firstMessages.push(message);
      }
   }
   
   return debug;
}());

// rend visible l'objet dans le contexte de la page
var expose = (function( ){
   var exposeName;
   var exposeArray = [];
   return function expose( obj, name ){
      if (name) {
         unsafeWindow[name] = obj;
      } else {
         if (!exposeName) {
            // choisit un nom qui n'existe pas déjà
            exposeName = "exposed_";
            while (exposeName in unsafeWindow) {
               exposeName += Math.random() * 1e16 | 0;
            }
            unsafeWindow[exposeName] = exposeArray;
         }
         exposeArray.push(obj);
      }
   };
}());

// [@UTI] Divers utilitaires ///////////////////////////////////////////

// Extension d'objet
Object.extend = function extend( subject, properties ){
   subject = subject || {};
   for (var p in properties)
      subject[p] = properties[p];
   return subject;
};

// Donne une description approximative de la durée écoulée entre la date
// donnée et maintenant, en omettant les unités trop petites
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
      var diff = Math.abs(new Date() - this);
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

// Gestion des classes HTML
var ClassName = {
   has: function hasClassName( $, c ){
      return $.className.indexOf(c) >= 0;
   },
   add: function addClassName( $, c ){
      if (!ClassName.has( $, c )) {
         $.className += " " + c;
      }
   },
   remove: function removeClassName( $, c ){
      $.className = $.className.replace(new RegExp(" *" + c, "g"), "");
   }
};

// Détecte la taille des barres de défilement
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

// Tranforme le nombre en chaîne en remplissant avec des zéros si besoin
Number.prototype.pad = function pad( digits ){
   var str = "" + this;
   var length = ("" + this).length;
   var zeros = digits - length;
   if (zeros > 0)
      return new Array(zeros + 1).join("0") + str;
   else
      return str;
}

// Gestion des attributs DOM
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

// [@WIN] Constructeur Window //////////////////////////////////////////

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
      if (this.$control) ClassName.add(this.$control, "lit");
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
      if (this.$control) ClassName.remove(this.$control, "lit");
      this.$window.style.opacity = "0";
      // the rest is achieved by the "transitionend" listener
   },
   
   /** Vide la fenêtre puis insère le contenu donné
    * @argument contents (optionnel)
    *    une String ou un HTMLElement ou un tableau de HTMLElements
    *    si String, remplit en utilisant textContent ;
    *    sinon, ajoute l'élément avec appendChild().
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
   
   /** Vide la fenêtre
    */
   clear: function clear( ){
      this.$container.innerHTML = "";
      this.$shader.style.display = "none";
   },
   
   /** Assombrit la fenêtre et affiche un indicateur de chargement
    * (spinner). En appelant wait(), vous signifiez que le contenu de la
    * fenêtre n'est plus à jour, et vous ne pourrez pas le récupérer.
    * utiliser update() ou clear() retirera l'ombre et le spinner.
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
   
   /** Affiche un message d'erreur, et associe éventuellement une action
    * à exécuter une fois que l’utilisateur a lu le message
    * @param {string} title     le titre du message d’erreur
    * @param {string} message   le message d’erreur
    * @param {function} next    (optionnel) l’action à exécuter
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
         ... le contenu de la fenêtre ici
      </container>
      <shader>
         <spinner>
            <spinnerLeft/>
            <spinnerMiddle/>
            <spinnerRight/>
         </spinner>
         <error>
            ... message d’erreur
         </error>
      </shader>
   </window>
*/

Window.template = (function( ){
   var $window = document.createElement("section");
   ClassName.add($window, "window");
   
   var $title = document.createElement("h3");
   $window.appendChild($title);
   
   var $closeButton = document.createElement("a");
   ClassName.add($closeButton, "close-button");
   $closeButton.textContent = "X";
   $closeButton.title = "Fermer"
   $window.appendChild($closeButton);
   
   var $container = document.createElement("div");
   ClassName.add($container, "window-container");
   $window.appendChild($container);
   
   var $shader = document.createElement("div");
   ClassName.add($shader, "window-shader");
   $window.appendChild($shader);
   
   var $spinner = document.createElement("div");
   var $spinnerLeft = document.createElement("div");
   var $spinnerMiddle = document.createElement("div");
   var $spinnerRight = document.createElement("div");
   ClassName.add($spinner, "spinner-box");
   ClassName.add($spinnerLeft, "spinner-left");
   ClassName.add($spinnerMiddle, "spinner-middle");
   ClassName.add($spinnerRight, "spinner-right");
   $spinner.appendChild($spinnerLeft);
   $spinner.appendChild($spinnerMiddle);
   $spinner.appendChild($spinnerRight);
   $shader.appendChild($spinner);
   
   var $error = document.createElement("section");
   ClassName.add($error, "error");
   $shader.appendChild($error);
   
   var $errorHeading = document.createElement("h4");
   $errorHeading.textContent = "Erreur";
   $error.appendChild($errorHeading);
   
   var $errorMessage = document.createElement("p");
   $error.appendChild($errorMessage);
   
   var $errorButton = document.createElement("a");
   ClassName.add($errorButton, "button");
   $errorButton.textContent = "Vu";
   
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
      var $button = document.createElement("a");
      $button.textContent = this.name;
      ClassName.add($button, "button");
      $li.appendChild($button);
      $bar.appendChild($li);
      
      var w = new Window(this.name, $button);
      
      var that = this;
      $button.addEventListener("click", function( event ){
         event.preventDefault();
         if (w.isOpened) {
            w.close();
            ClassName.remove($button, "lit");
         } else {
            w.open();
            that.exec(w);
            ClassName.add($button, "lit");
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
            var $ok = document.createElement("a");
            ClassName.add($ok, "button small");
            $ok.textContent = "Ok";
            $ok.title = "Valider le changement de la langue"
            $ok.addEventListener("click", function( ){
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
                        message + " / Ce n’est probablement qu’une " +
                           "défaillance passagère du réseau, " + 
                           "veuillez réesayer.",
                        function( ){ w.close(); });
                  }
               });
            }, false);
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
                        ClassName.add($row, "selected-realm");
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
                  ClassName.remove($selectedRealm, "selected-realm");
               var $tr = $target.parentNode;
               ClassName.add($tr, "selected-realm");
               $selectedRealm = $tr;
               selectedRealmId = $tr.firstChild.textContent * 1;
               ClassName[selectedRealmId == currentRealmId ?
                  "add" : "remove"]($ok, "disabled");
            }, false);
            
            $div = document.createElement("div");
            ClassName.add($div, "limited-height");
            $div.appendChild($table);
            contents.push($div);
            
            var $ok = document.createElement("a");
            ClassName.add($ok, "button disabled");
            $ok.textContent = "Ok";
            $ok.title = "Valider le changement de royaume"
            
            $ok.addEventListener("click", function( ){
               if (ClassName.has(this, "disabled")) return;
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
                                 "Je ne peux pas joindre le nouveau " + 
                                    "royaume",
                                 function( ){ w.close(); });
                           }
                        }
                     });
                  }
               });
            }, false);
            
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
                  "les objets seront affichés avec leurs codes.\n" +
                  "(raison\xA0:\n" + error + ")");
               return;
            }
            
            var regexp = new RegExp("<(" + prize.toLowerCase() + ")>\\s*" +
               "(?:<name>([\\x20-\\x7E\\s]*?)</name>\\s*)?" +
               "(?:<description>([\\x20-\\x7E\\s]*?)</description>\\s*)?" +
               "(?:<name>([\\x20-\\x7E\\s]*?)</name>\\s*)?" +
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
               debug(prize);
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
      
      // handle images
      var isResource = false;
      var isTroop = false;
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
         if ("Stack" == chunk) isTroop = false;
         if ("Chest" == chunk) isChest = true;
         if ( "Gold" == chunk) isGold = true;
         if (  "Egg" == chunk) isEgg = true;
         if (   !isNaN(chunk)) num = chunk;
      });
      if (isTroop) {
         dir = "troops/";
         src = chunks.slice(0, chunks.indexOf(num)).join("");
      } else {
         dir = "item/";
         if (isResource) {
            if (isGold) src = "gold";
            else        src = chunks[0].toLowerCase();
         } else if (isChest) {
            chestName = "configurablechest" + num;
            src = "configurablechest";
            GameData.retrieve("chests", function( data, error ){
               if (error) {
                  w.error("Erreur pas trop grave",
                     "Je n'ai pas pu charger les images de coffres, " +
                     "ils auront tous l’image par défaut.\n" +
                     "(raison\xA0:\n" + error + ")");
                  return;
               }
               if (prize in data) setTimeout(function( ){
                  $img.src = Ajax.vars.s3Server + "/flash/assets/" +
                     dir + data[prize];
               }, 0);
            });   
         } else if (isEgg) {
            var eggType = chunks[1].toLowerCase();
            if ("mephitic" == eggType) eggType = "swamp";
            if (   "helio" == eggType) eggType = "desert";
            src = eggType + "dragonegg";
         } else {
            src = chunks.join("").toLowerCase();
         }
      }
      $img.onerror = function( ){
         debug(prize, this.src);
      };
      $img.src = Ajax.vars.s3Server +
         "/flash/assets/" + dir + src + ".jpg";
   }

   function requestList( e, ticketType ){
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
               "Chance de Fortuna" : "Salle des coffres"; // i18n
            
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
               
               /* TODO weight et weightSum serviront à calculer la
               probabilité d'obtenir le(s) objet(s) préalablement
               désignés par le joueur */
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
            
            var $ok = document.createElement("a");
            ClassName.add($ok, "button");
            $ok.textContent = "Ok";
            $ok.title = "Je tente, me file pas de la merde cette fois…";
            $ok.addEventListener("click", function( ){
               w.wait();
               Ajax.signedPost({
                  url: Ajax.vars.apiServer +
                     "/minigames/save_result.json",
                  responseType: "json",
                  parameters: {
                     ticket_type: ticketType,
                     minigame_timestamp: timestamp
                  },
                  onload: function( r ){
                     var $h4 = document.createElement("h4");
                     $h4.textContent = "Vous avez gagné\xA0:";
                     
                     var $img = document.createElement("img");
                     var result = r.response.result;
                     if (!result.success) {
                        w.error("Échec", result.reason, function( ){
                           displayMenu();
                        });
                        return;
                     }
                     GameData.update("player");
                     
                     var prizeType = result.item_won.type;
                     
                     var $span = document.createElement("span");
                     setupPrizeInfo(prizeType, $img, $span);
                     
                     var $p = document.createElement("p");
                     $p.id = "fortuna-prize";
                     $p.appendChild($img);
                     $p.appendChild($span);
                     
                     var $button = document.createElement("a");
                     ClassName.add($button, "button");
                     $button.textContent = "Continuer";
                     $button.addEventListener(
                        "click", displayMenu, false);
                     var $okP = document.createElement("p");
                     $okP.appendChild($button);
                     
                     w.update([$h4, $p, $okP]);
                  }
               });
            });
            
            var $change = document.createElement("a");
            ClassName.add($change, "button");
            $change.textContent = "Changer";
            $change.title = "C’est de la daube, sers-moi autre chose";
            $change.addEventListener("click", function( ){
               requestList(null, ticketType);
            });
            
            var $cancel = document.createElement("a");
            ClassName.add($cancel, "button");
            $cancel.textContent = "Annuler";
            $cancel.title = "Ça me saoûle, je laisse tomber";
            $cancel.addEventListener("click", function( ){
               w.close();
            });
            
            var $ul = document.createElement("ul");
            ClassName.add($ul, "button-list");
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
         var golden = (tickets.gold_club | 0); // + (items.XXX | 0)
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
            ClassName.add($li, hasPlayedThisDay ?
               "fortuna-played-day" : isCounting ?
                  "fortuna-missed-day" : "");
            if ($previous) $ul.insertBefore($li, $previous);
            else $ul.appendChild($li);
            $previous = $li;
         }
         contents.push($ul);
         
         if (regular || golden) {
            $ul = document.createElement("ul");
            ClassName.add($ul, "button-list");
            contents.push($ul);
         } else {
            $p = document.createElement("p");
            $p.textContent = "Plus rien, attendez demain…";
            contents.push($p);
         }
         
         var s;
         var $button;
         if (regular) {
            $button = document.createElement("a");
            ClassName.add($button, "button");
            s = regular > 1 ? "s" : "";
            $button.textContent =
               regular + " ticket" + s + " simple" + s;
            $button.setAttribute("data-ticket-type", "regular");
            $button.addEventListener("click", requestList, false);
            $li = document.createElement("li");
            $li.appendChild($button);
            $ul.appendChild($li);
         }
         
         if (golden) {
            $button = document.createElement("a");
            ClassName.add($button, "button");
            s = golden > 1 ? "s" : "";
            $button.textContent = golden + " médaillon" + s;
            $button.setAttribute("data-ticket-type", "golden");
            $button.addEventListener("click", requestList, false);
            $li = document.createElement("li");
            $li.appendChild($button);
            $ul.appendChild($li);
         }
            
         w.update(contents);
      });
   }
   displayMenu();
});

// [@DAT] Données de jeu ///////////////////////////////////////////////

var GameData = (function( ){
   var _cache = {};
   
   var _keys = {
      player: {
         url: "{apiServer}/player.json",
         loadMethod: "getJson"
      },
      chests: {
         url: "{s3Server}/flash/assets/item/thumbnails.json?b={lazyLoadedSwfCachebreaker}",
         loadMethod: "getJson"
      },
      manifest: {
         url: "{apiServer}/manifest.json",
         loadMethod: "getJson"
      },
      map: {
         url: "{s3Server}{s3SwfPrefix}/map.bin?b={mapBinCacheBreaker}",
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
            
         } else {
         
            var handler = _keys[key];
            if (!handler.pendingRequests) handler.pendingRequests = [];
            if (!handler.pendingRequests.length) {
               Ajax[handler.loadMethod](Object.extend(handler.options, {
                  url: handler.url.replace(/\{([^\}]+)\}/g,
                     function( _, varName ) Ajax.vars[varName]),
                     
                  onload: function( response ){
                     var data = response.response;
                     _cache[key] = data;
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
         }
      },
      
      retrieveMulti: function retrieveMulti( keys, callback ){
         var requirementsCount = keys.length;
         var multiError = {};
         var multiData = {};
         
         function decreaseAndCheck( ){
            if (!--requirementsCount)
               callback(multiData, multiError);
         }
         
         keys.forEach(function( key ){
            if (GameData.isLoaded(key)) decreaseAndCheck();
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

// [@INI] Initialisation du script /////////////////////////////////////

// initialise l'objet flash, oui, celui qui ne devrait plus exister...
// n'appeler cette fonction qu'après qu'Ajax.vars ait été peuplé
function initSwf( $swf ){
   var $flashvars = $swf.querySelector("param[name=flashvars]");
   
   var overrideVars = {
      width: window.innerWidth,
      height: window.innerHeight,
      paymentExtra: "sblarff:" // protocole inexistant
   };
   for (var v in overrideVars)
      Ajax.vars[v] = overrideVars[v];
   
   [
      // serveurs api et contenu
      "api_server",
      "s3_server",
      "s3_swf_prefix",
      
      // identifiants joueur
      "session_id",
      "user_id",
      "dragon_heart",
      
      // langue
      "locale",
      
      // réseaux sociaux
      "facebook_id",
      "viral",
      
      // paramètres visuels
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
      
      // cdn
      "mode_is_cdn",
      "preloader_url",
      "ruby_store_url",
      "assets_server",
      "assets_prefix",
      "statics_server",
      
      // publicité
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
      $swf.data = Ajax.vars.s3Server + Ajax.vars.s3SwfPrefix +
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

switch (location.hostname.match(/(\w+)\.\w+$/)[1]) {

case "kabam": ///////////////////////////////////////////////////////
   
   document.title = "HybriDoA";
   
   // prévention des scripts : Firefox seulement.
   // Ce n'est pas vital mais ça économise pas mal de traitement
   // et de trafic réseau inutile.
   document.addEventListener("beforescriptexecute", function( e ){
      e.preventDefault();
   });

   document.addEventListener("DOMContentLoaded", function( ){
      var $body = document.body;
      var $html = document.documentElement;
      var $form = document.getElementById("post_form");
      
      // sauvegarde des noeuds DOM
      var $saver = document.createElement("div");
      $saver.appendChild($form);
      
      // nettoyage du HTML
      Array.prototype.forEach.call(
         $html.querySelectorAll("script, style, link[rel=stylesheet]"),
         function( $ ){ $.parentNode.removeChild($); }
      );
      Attribute.removeAll($html, "lang", "dir");
      $body.innerHTML = "";
      Attribute.removeAll($body);
      
      // repeuplement du DOM
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
      
      // lancement du jeu
      $form.target = $iframe.name = "hybridoa-iframe";
      $form.submit();
      
   });
   break;

case "wonderhill": //////////////////////////////////////////////////
   // Attenion : expose() ne fonctionne pas ici, car unsafeWindow
   // renvoie le contexte de l'iframe.
   
   if (FIREFOX) {
      // annule les scripts et récupère les valeurs de C.attrs.
      document.addEventListener("beforescriptexecute", function( e ){
         e.preventDefault();
         var regexp = /^\s*C\.attrs\.(\w+)\s+=\s*([^;$]+)/gm;
         //                C .attrs .( 1 )   =   (  2   )
         var text = e.target.textContent;
         var match;
         while (match = regexp.exec(text)) {
            // le bloc try/catch prévient une erreur à cause des
            // labels incorrects dans googlePaymentTokens
            try { Ajax.vars[match[1]] = eval(match[2]); } catch (_) {}
         }
      }, false);
   }
   
   document.addEventListener("DOMContentLoaded", function( ){
      var $html = document.documentElement;
      var $body = document.body;
      $body.onload = "";
      $body.onresize = "";
      
      if (!FIREFOX) {
         // Navigateurs non Firefox : les scripts n'ont pas été annulés
         // par beforescriptexecute, il va falloir faire un peu de
         // travail dessus…
         
         // V6 est une usine à gaz inutile, on empêche son chargement
         unsafeWindow.V6.go = function( ){};
         
         // redéfinit la fonction platforms_kabam_game_show, qui est
         // appelée juste après que les variables de C.attrs aient été
         // initialisées. Ceci permet de récupérer ces variables et de
         // prévenir du même coup le chargement du Flash.
         var C = unsafeWindow.C;
         C.views.platforms_kabam_game_show = function( ){
            var Cattrs = C.attrs;
            for (var attr in Cattrs)
               Ajax.vars[attr] = Cattrs[attr];
         };
      }
      
      // nettoie le html
      Attribute.removeAll($html, "xmlns");
      $html.lang = "fr";                        // i18n
      $html.setAttribute("xml:lang", "fr-FR");  // i18n
      $body.innerHTML = "";
      Attribute.removeAll($body);
      Array.prototype.forEach.call(document.querySelectorAll(
            "style, link[type='text/css'], script"),
         function( $ ){ $.parentNode.removeChild($); });
      
      // insère le nouveau contenu
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
      
      // boutons de contrôle du flash
      var $startButton = document.getElementById("start-button");
      var flashLoaded = false;
      
      // timer pour stopper le flash quand Cassandra apparaît
      var cassandraTimer;
      const CASSANDRA_DELAY = 420 * 1000;
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
               var now = new Date() * 1;
               if (now - previousResize >= 1000) {
                  var controlsStyle = getComputedStyle($controls, null);
                  var controlsHeight = parseInt(controlsStyle.height) +
                     parseInt(controlsStyle.borderTopWidth);
                  $swf.width = $html.clientWidth;
                  $swf.height = $html.clientHeight - controlsHeight;
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

// [@AJX] Primitives ajax //////////////////////////////////////////////

const VERSION = "overarch";
const DORSAL_SPINES = "LandCrocodile";
const LEVIATHON = "Bevar-Asp";
const DRACO = "Draoumculiasis";

var Ajax = {
   vars: {},
   
   // format de timestamp en secondes utilisé par le jeu
   getTimestamp: function getTimestamp( ) "" + (new Date() / 1000 | 0),
   
   // les paramètres requis pour toute requête vers Wonderhill
   get mandatoryParameters( ) ({
      "_session_id" : Ajax.vars.sessionId,
      "dragon_heart": Ajax.vars.dragonHeart,
      "user_id"     : Ajax.vars.userId,
      "version"     : VERSION,
      "timestamp"   : Ajax.getTimestamp()
   }),
   
   // transforme un objet en chaîne de paramètres d'URL
   serialize: function serialize( object ){
      var chunks = [];
      for (var prop in object) {
         chunks.push(encodeURIComponent(prop) + "=" +
            encodeURIComponent(object[prop]));
      }
      return chunks.join("&");
   },
   
   // méthode de gestion d'erreur par défaut
   error: function error( message ){
      console.error(this, message);
   },
   
   /** méthode de plus bas niveau : sur elle reposent toutes les autres
   * @param {object} options
   *  un objet contenant :
   *            method  (requis) la méthode HTTP ("post" ou "get")
   *                    
   *               url  (requis) l'URL de la requête
   *  
   *        parameters  un objet contenant les paramètres de la requête
   *                    
   *              data  la chaîne de paramètres
   *                    (si spécifiée, parameters est ignoré)
   *                    
   *           headers  un objet contenant des en-têtes additionnels
   *                    
   *      responseType  le type de réponse attendu
   *                    ("arraybuffer", "json", ou "text")
   *                    
   *  overrideMimeType  un type MIME à forcer
   *                    
   *            onload  la fonction à appeler en cas de succès
   *                    
   *        onprogress  la fonction à appeler à chaque paquet reçu
   *                    
   *           onerror  la fonction à appeler en cas d'erreur
   *
   * Important :
   * le paramètre passé aux fonctions de rappel s'inspire de la norme
   * XMLHttpRequest niveau 2. En particulier, il possède une propriété
   * `response` dont le type dépend de `responseType`. Ainsi, les
   * fonctions de rappel n'ont pas besoin de traiter `responseText` si
   * le bon `responseType` a été demandé.
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
               // spécifie volontairement un charset inconnu pour que le
               // navigateur ne transforme pas les données binaires
               gmOptions.overrideMimeType =
                  "text/plain; charset=x-user-defined";
               gmOptions.onload = Ajax.switchCallback(function( r ){
                     var text = r.responseText;
                     var buffer = new ArrayBuffer(text.length);
                     var bytes = new Uint8Array(buffer);
                     for (var i = text.length; i--;)
                        bytes[i] = text.charCodeAt(i) & 0xff;
                     // TODO 
                     // ce traitement est potentiellement long
                     // (le fichier map.bin fait environ 550 Ko)
                     // => envisager l'utilisation d'un Web Worker ?
                     
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
      // DoA XML files aren't well formed, so I treat it as text
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

// [@SHA] Implémentation JavaScript du SHA-1 ///////////////////////////

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
