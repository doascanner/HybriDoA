HybriDoA
========

HybriDoA est un userscript pour le jeu web Dragons of Atlantis (DoA).
Les userscripts sont des scripts permettant de personnaliser les pages
Web que l'on visite. Ils s'utilisent sous Firefox avec l'extension
[Greasemonkey](https://addons.mozilla.org/fr/firefox/addon/greasemonkey/).

DoA est un jeu web en réseau dont la partie client est faite en Flash.
L'interface est horriblement lente et bourrée de bugs, c'est pourquoi
HybriDoA propose une nouvelle interface, légère et robuste, qui élimine
du même coup la dépendance au plugin Flash Player.

Le projet est en tout début de développement. L'interface HTML
comportera des boutons pour lancer l'application originale en Flash
jusqu'à ce que suffisamment de fonctions aient été implémentées.

Actuellement réalisé :

- Changement de royaume
- Chance de Fortuna / Salle des coffres

Contribuez !
------------

Voici quelques conseils si vous voulez contribuer au projet.

- D'abord, repérez les 3 fichiers du projet :
    * **hybridoa.user.js** est le fichier principal. Il est documenté à
       l'intérieur.
    * **hybridoa.html** contient la mise en page de remplacement, qui
       est injectée dans le DOM au chargement de la page.
    * **hybridoa.css** est la feuille de style associée.

- Ensuite, je cherche à rendre mon script compatible avec tous les
    gestionnaires d'userscripts. Certains sont des extensions, comme
    Tampermonkey pour Chrome, d'autres sont intégrés nativement au
    navigateur, comme pour Opera.
    
    La compatibilité passe par le retrait de tous les appels aux
    fonctions `GM_*` de l'API Greasemonkey. Cela implique d'abandonner
    `GM_xmlhttpRequest` qui permet de faire des requêtes cross-domain ;
    je n'ai pas encore vérifié si cela était possible. Il faudra aussi
    abandonner le système de ressources, et par conséquent concaténer
    les 3 fichiers en un seul (je ferai un make ou un script shell
    pour automatiser ça).
    
    Si l'abandon de l'API `GM_*` est possible, alors il faudra remplacer
    toutes les formes de syntaxe « trop modernes » par leur équivalent
    traditionnel. Par exemple, `Array.forEach(…)` par
    `Array.prototype.forEach.call(…)`, ou encore `function( x ) x + 2;`
    par `function( x ){ return x + 2; }`.
    
    Sinon HybriDoA ne marchera que sous Firefox, ce qui nous permettra
    de développer dans un environnement plus confortable.
