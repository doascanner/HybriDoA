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
// @resource      html     hybridoa.html
// @resource      style    hybridoa.css
//
// @run-at        document-start
// @grant         GM_xmlhttpRequest
// @grant         GM_getResourceText
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
   todo, xxx, debug, here, i18n
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
   
   this.$control = $control;
}

// constante à garder synchronisée avec le CSS
Window.OPACITY_TRANSITION = 100; // en millisecondes

Window.prototype = {
   
   $window: null,
   $container: null,
   $shader: null,
   $spinner: null,
   $error: null,
   $control: null,
   isOpened: false,
   
   open: function open( ){
      var style = this.$window.style;
      style.display = "block";
      style.opacity = "0";
      var that = this;
      setTimeout(function( ){
         style.opacity = "1";
         if (that.$control) ClassName.add(that.$control, "lit");
         that.isOpened = true;
         setTimeout(function( ){ that.center(); }, 0);
      }, 0);
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
         var extraH = (windowW > $body.offsetWidth) ? Scrollbars.height : 0;
         style.left = (windowW - extraW - computedW) / 2 + "px";
         style.top = (windowH - extraH - computedH) / 2 + "px";
      }
   },
   
   close: function close( ){
      if (this.$control) ClassName.remove(this.$control, "lit");
      this.isOpened = false;
      var style = this.$window.style;
      style.opacity = "0";
      setTimeout(function( ){
         style.display = "none";
      }, 300);
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
      ajaxGet("/platforms/kabam/lightboxes/change_realm", {
         signed_request: Ajaxvars.signedRequest,
         i18n_locale: selectedLocale
      }, function( r ){
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
            ajaxPost(location.href, {
               i18n_locale: loc
            }, function( r ){
               selectedLocale = loc;
               w.wait();
               refreshRealms();
            });
         }, false);
         $p.appendChild(document.createTextNode(" "));
         $p.appendChild($ok);
         contents.push($p);
         
         var $div = document.createElement("div");
         $div.innerHTML = r.responseText;
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
         
         var $box = document.createElement("div");
         ClassName.add($box, "limited-height");
         $box.appendChild($table);
         contents.push($box);
         
         var $ok = document.createElement("a");
         ClassName.add($ok, "button disabled");
         $ok.textContent = "Ok";
         $ok.title = "Valider le changement de royaume"
         
         $ok.addEventListener("click", function( ){
            if (ClassName.has(this, "disabled")) return;
            w.wait();
            var realmId = $selectedRealm.firstChild.textContent;
            ajaxPost(Ajaxvars.serverUrl +
               "/platforms/kabam/change_realm/" + realmId,
               {}, function( response ){
                  var json = JSON.parse(response.responseText);
                  if (!json.realmwiseurl) {
                     debug(json);
                     w.error("Erreur",
                        "Impossible d’obtenir l'adresse du royaume",
                        w.close);
                     return;
                  }
                  ajaxPost(json.realmwiseurl, {},
                     function( wiseResponse ){
                        var wiseJson =
                           JSON.parse(wiseResponse.responseText);
                        debug(wiseJson);
                        if (wiseJson.success) {
                           top.location.href = Ajaxvars.appPath;
                        } else {
                           debug(wiseJson);
                           w.error("Erreur",
                              "Impossible de joindre le nouveau royaume",
                              w.close);
                        }
                     });
               });
         }, false);
         
         var $okP = document.createElement("p");
         $okP.appendChild($ok);
         contents.push($okP);
         
         w.update(contents);
      });
   }
   refreshRealms();
});

new Module("Fortuna", function( w ){
   var chests = {};
   retrieveGameData("chests", function( chestData, error ){
      if (error) w.error("Chargement de chests.json échoué", error,
         w.close);
      for (var chestIndex in chestData) {
         chests[chestIndex.toLowerCase()] =
            chestData[chestIndex].replace(/\.jpg$/g, "");
      }
      // (TODO) refreshChestImages();
   });
   
   function getPrizeImageSrc( prizeType ){
      var isResource = false;
      var isTroop = false;
      var isChest = false;
      var isGold = false;
      var chunks = prizeType.match(/\d+|[A-Z][a-z]*|[a-z]+/g);
      var num;
      var image;
      var dir;
      var chestName;
      
      chunks.forEach(function( chunk ){
         if ("K" == chunk) isResource = isResource || true;
         if ("Troop" == chunk) isTroop = isTroop || true;
         if ("Chest" == chunk) isChest = isChest || true;
         if ("Gold" == chunk) isGold = isGold || true;
         if ("Stack" == chunk) isTroop = false;
         if (!isNaN(chunk)) num = chunk;
      });
      if (isTroop) {
         dir = "troops/";
         image = chunks.slice(0, chunks.indexOf(num)).join("");
      } else {
         dir = "item/";
         if (isResource) {
            if (isGold) image = "gold";
            else        image = chunks[0].toLowerCase() + "50k";
         } else if (isChest) {
            chestName = "configurablechest" + num;
            image = chests[chestName] || "configurablechest";
         }
         else image = chunks.join("").toLowerCase();
      }
      return Ajaxvars.s3Server + "/flash/assets/" + dir + image + ".jpg";
   }

   function requestList( e, ticketType ){
      ticketType = ticketType || e.target.dataset.ticketType;
      w.wait();
      
      ajaxGet(Ajaxvars.apiServer + "/minigames/index.json",
         { ticket_type: ticketType },
         function( r ){
            var json = JSON.parse(r.responseText);
            var timestamp = Math.floor(json.timestamp);
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
               $img.alt = type;
               $img.width = 228;
               $img.height = 152;
               $img.src = getPrizeImageSrc(type);
               $cell.appendChild($img);
               
               $span = document.createElement("span");
               $span.textContent = type;
               $cell.appendChild($span);
            }
            
            var $ok = document.createElement("a");
            ClassName.add($ok, "button");
            $ok.textContent = "Ok";
            $ok.title = "Je tente, me file pas de la merde cette fois-ci…";
            $ok.addEventListener("click", function( ){
               w.wait();
               ajaxPost(Ajaxvars.apiServer + "/minigames/save_result.json",
                  {
                     ticket_type: ticketType,
                     minigame_timestamp: timestamp
                  },
                  function( r ){
                     var $h4 = document.createElement("h4");
                     $h4.textContent = "Vous avez gagné\xA0:";
                     
                     var $img = document.createElement("img");
                     var result = JSON.parse(r.responseText).result;
                     if (!result.success) {
                        w.error("Échec", result.reason, function( ){
                           displayMenu();
                        });
                        return;
                     }
                     var prizeType = result.item_won.type;
                     $img.alt = prizeType;
                     $img.src = getPrizeImageSrc(prizeType);
                     
                     var $span = document.createElement("span");
                     $span.textContent = prizeType;
                     
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
                  });
            }, false);
            
            var $change = document.createElement("a");
            ClassName.add($change, "button");
            $change.textContent = "Changer";
            $change.title = "C’est de la daube tes trucs, sers-moi autre chose";
            $change.addEventListener("click", function( ){
               requestList(null, ticketType);
            }, false);
            
            var $cancel = document.createElement("a");
            ClassName.add($cancel, "button");
            $cancel.textContent = "Annuler";
            $cancel.title = "Ça me saoûle, je laisse tomber pour l’instant";
            $cancel.addEventListener("click", displayMenu, false);
            
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
         });
   }
   
   function displayMenu( ){
      w.wait();
      retrieveGameData("player", function( playerData, error ){
         if (error) w.error("Chargement de player.json échoué", error,
            w.close);
         
         var tickets = playerData.tickets;
         var items = playerData.items;
         var regular = 1 * items.FortunasTicket + 1 * tickets.fortunas_chance;
         var golden = 1 * items.FoundersChest + 1 * tickets.gold_club;
         var retention = playerData.retention;
         var contents = [];
         var $button;
         var s;
         
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
            var $button = document.createElement("a");
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

var GameDataUrls = {
   player:   "{apiServer}/player.json",
   chests:   "{s3Server}/flash/assets/item/thumbnails.json?b={lazyLoadedSwfCachebreaker}",
   manifest: "{apiServer}/manifest.json",
   map:      "{s3Server}{s3SwfPrefix}/map.bin?b={mapBinCacheBreaker}"
};
var retrieveGameData = (function( ){
   var _cache = {};
   
   return function retrieveGameData( key, callback ){
      if (key in _cache) {
         callback(_cache[key]);
      } else {
         ajaxGet(GameDataUrls[key].replace(/\{([^\}]+)\}/g,
            function( _, varName ){
               return Ajaxvars[varName];
            }),
         {}, function( r ){
            try {
               var json = JSON.parse(r.responseText);
               _cache[key] = json;
               callback(json);
            } catch (e) {
               callback(null, e);
            }
         });
      }
   };
}());

// [@INI] Initialisation du script /////////////////////////////////////

// initialise l'objet flash, oui, celui qui ne devrait plus exister...
// n'appeler cette fonction qu'après qu'Ajaxvars ait été peuplé
function initSwf( $swf ){
   var $flashvars = $swf.querySelector("param[name=flashvars]");
   
   var overrideVars = {
      width: window.innerWidth,
      height: window.innerHeight,
      paymentExtra: "/"
   };
   for (var v in overrideVars)
      Ajaxvars[v] = overrideVars[v];
   
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
      
      // publicité
      "payment_extra",
      
      // ?
      "platform",
      "subnetwork",
      "user_hash",
   ].forEach(function( name ){
      var value = Ajaxvars[name.replace(/_(\w)/gi,
         function( s, s1 ){ return s1.toUpperCase(); })];
      $flashvars.value += name + "=" + value + "&";
   });
   var v = $flashvars.value;
   $flashvars.value = v.substr(0, v.length - 1);
   $swf.data = Ajaxvars.s3Server + Ajaxvars.s3SwfPrefix +
      "/preloader.swf?cachebreaker=" + Ajaxvars.preloaderCachebreaker;
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
   
   /* prévention des scripts : Firefox seulement.
      Ce n'est pas vital mais ça économise pas mal de traitement
      et de trafic réseau inutile. */
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
         $html.querySelectorAll("script, style,\
            link[rel='stylesheet']"),
         function( $ ){ $.parentNode.removeChild($); }
      );
      Attribute.removeAll($html, "lang", "dir");
      $body.innerHTML = "";
      Attribute.remove($body, "id", "class");
      
      // repeuplement du DOM
      injectStyle("html, body, iframe {\
         display: block;\
         width: 100%;\
         height: 100%;\
         margin: 0;\
         border: none;\
      }");
      
      $body.appendChild($form);
      
      var $iframe = document.createElement("iframe");
      $iframe.name = "game_frame";
      $iframe.src = "#";
      $iframe.width = window.innerWidth;
      $iframe.height = window.innerHeight;
      $body.appendChild($iframe);
      
      // lancement du jeu
      $form.submit();
      
   });
   break;

case "wonderhill": //////////////////////////////////////////////////
   
   
   debug("body loaded?", document.body);
   
   if (FIREFOX) {
      // annule les scripts et récupère les valeurs de C.attrs.
      document.addEventListener("beforescriptexecute", function( e ){
         e.preventDefault();
         var regexp = /^\s*C\.attrs\.(\w+)\s+= ([^;$]+)/gm;
         var text = e.target.textContent;
         var match;
         while (match = regexp.exec(text)) {
            // le bloc try/catch prévient une erreur à cause des
            // labels incorrects dans googlePaymentTokens
            try { Ajaxvars[match[1]] = eval(match[2]); } catch (_) {}
         }
      }, false);
   }
   
   document.addEventListener("DOMContentLoaded", function( ){
      var $html = document.documentElement;
      var $body = document.body;
      
      if (!FIREFOX) {
         /* Les scripts n'ont pas été annulés, il va falloir faire un 
         peu de travail dessus… */
         
         unsafeWindow.V6.go = function( ){};
         
         /* redéfinit la fonction platforms_kabam_game_show, qui est
         appelée juste après que les variables de C.attrs aient été
         initialisées. Ceci permet de récupérer ces variables et de
         prévenir du même coup le chargement du Flash. */
         var C = unsafeWindow.C;
         C.views.platforms_kabam_game_show = function( ){
            var Cattrs = C.attrs;
            for (var attr in Cattrs)
               Ajaxvars[attr] = Cattrs[attr];
         };
      }
      
      // nettoie le html
      Attribute.remove($html, "xmlns:fb");
      $html.lang = "fr";                        // i18n
      $html.setAttribute("xml:lang", "fr-FR");  // i18n
      $body.innerHTML = "";
      debug($body);
      Attribute.removeAll($body);
      debug($body);
      Array.prototype.forEach.call(document.querySelectorAll(
         "style, link[type='text/css'], script"),
         function( $ ){ $.parentNode.removeChild($); });
      
      // insère le nouveau contenu
      injectStyle(GM_getResourceText("style"));

      var $html = document.documentElement;
      var $body = document.body;
      
      document.title = "HybriDoA";
      $body.innerHTML = GM_getResourceText("html");
      var $controls = document.getElementById("controls");
      var $swf = document.getElementById("swf");
      
      // boutons de contrôle du flash
      var $startButton = document.getElementById("start-button");
      var flashLoaded = false;
      $startButton.addEventListener("click", function( event ){
         event.preventDefault();
         this.textContent = "…";
         var that = this;
         setTimeout(function( ){
            that.textContent = "Restart";
         }, 2000);
         
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
            var $parent = $swf.parentNode;
            if ($parent) $parent.removeChild($swf);
            setTimeout(function( ){
               $body.insertBefore($swf, $body.firstChild);
            }, 700);
         }
      });
      
      var $stopButton = document.getElementById("stop-button");
      $stopButton.addEventListener("click", function( event ){
         event.preventDefault();
         var $parent = $swf.parentNode;
         if ($parent) $parent.removeChild($swf);
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

var Ajaxvars = {};
expose(Ajaxvars, "Ajaxvars");
var staticParams;

function _ajax( request ){
   var broker = new XMLHttpRequest();
   broker.onreadystatechange = function( ){
      console.info(this.readyState, this.status);
      if (XMLHttpRequest.DONE == this.readyState) {
         if (200 == this.status) request.onload(this);
      }
   };
   var method = request.method.toUpperCase();
   broker.open(method, request.url);
   if ("POST" == method) {
      broker.setRequestHeader("content-type",
         "application/x-www-form-url-encoded");
   }
   if (request.headers) {
      for (var [header, value] in Iterator(request.headers)) {
         broker.setRequestHeader(header, value);
      }
   }
   broker.send("POST" == method ? request.data : null);
};

function getTimestamp( ){
   return new String(new Date() / 1000 | 0);
};

function getMandatoryParams( ){
   if (!staticParams) {
      staticParams = "_session_id=" + Ajaxvars.sessionId +
         "&dragon_heart=" + Ajaxvars.dragonHeart +
         "&user_id=" + Ajaxvars.userId +
         "&version=" + VERSION +
         "&timestamp=";
   }
   return staticParams + getTimestamp();
};
expose(getMandatoryParams, "getMandatoryParams");

function ajaxError( ajax ){
   console.error(ajax.status, ajax.statusText, ajax.responseText);
}

function ajaxGet( url, params, callback, options ){
   params = params || {};
   var data = "?";
   for (var p in params)
      data += p + "=" + params[p] + "&";
   data += getMandatoryParams();
   var request = {
      method: "get",
      url: url + data,
      onerror: ajaxError,
      onload: callback
   };
   if (options) {
      for (var optName in options) {
         request[optName] = options[optName];
      };
   }
   GM_xmlhttpRequest(request);
};

function ajaxPost( url, params, callback, isSigned ){
   if (undefined === isSigned) isSigned = true;
   params = params || {};
   var data = "";
   for (var p in params)
      data += p + "=" + params[p] + "&";
   data += getMandatoryParams();
   
   var headers = {};
   if (isSigned) {
      var str = DRACO + data + DORSAL_SPINES + url + LEVIATHON;
      var sig = SHA1(str);
      headers = {
         "Content-length": data.length,
         "Content-type": "application/x-www-form-urlencoded",
         "X-S3-AWS": sig
      };
   }
   
   GM_xmlhttpRequest({
      method: "post",
      url: url,
      data: data,
      onload: callback,
      onerror: ajaxError,
      headers: headers
   });
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
