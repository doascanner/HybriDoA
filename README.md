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

- Repérez les différents fichiers du projet :
    * **hybridoa.user.js** est le fichier principal. Il est documenté à
      l'intérieur.
    * **hybridoa.html** contient la mise en page de remplacement, qui
      est injectée dans le DOM au chargement de la page.
    * **hybridoa.css** est la feuille de style associée.
    * Les fichiers de langue (à venir).
    * Éventuellement des fichiers de modules si le fichier source
      principal devient trop gros. Ils seront concaténés avec un script
      shell.

- Le script tourne en mode strict. Plus d'infos :
   * [sur la doc du MSDN (fr)](http://msdn.microsoft.com/fr-fr/library/ie/br230269%28v=vs.94%29.aspx)
   * [sur le blog de John Resig (en)](http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/)

- Je sais qu'il est possible de dialoguer avec les différents serveurs du
   jeu sans utiliser `GM_xmlhttpRequest`, le script Kabalistics de Jawz le
   fait. Ainsi, il devrait être possible de rendre HybriDoA compatible avec
   d'autres navigateurs que Firefox.
   Je cherche des gens pour m'aider dans cette quête. Si vous vous y
   connaissez en développement de userscripts (de préférence natifs) pour
   Chrome ou Opera, vous êtes les bienvenus !
