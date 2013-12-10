HybriDoA
========

HybriDoA est un *script utilisateur* (userscript) pour le jeu Dragons of Atlantis (DoA) sur Kabam.com.
Les userscripts sont de petits scripts permettant de modifier à sa convenance les pages
Web que l'on visite. On peut les utiliser par exemple sous Firefox grâce à l'extension
[Greasemonkey](https://addons.mozilla.org/fr/firefox/addon/greasemonkey/).

DoA est un jeu web en réseau dont la partie client est faite en Flash.
L'interface est horriblement lente et bourrée de bugs, c'est pourquoi
HybriDoA propose une nouvelle interface, légère et robuste, qui élimine
du même coup la dépendance au plugin Flash Player.

Le projet est en tout début de développement. L'interface HTML
comportera des boutons pour lancer l'application originale en Flash
jusqu'à ce que suffisamment de fonctions aient été mises en œuvre.

Actuellement réalisé :

- Changement de royaume
- Chance de Fortuna / Salle des coffres
- Affichage de la carte (ébauche)
- Liste (rudimentaire) des entraînements en cours


Guide d'installation
--------------------

Actuellement, HybriDoA fonctionne seulement avec Greasemonkey, extension de Firefox.
Pour l'installer, c'est très simple&nbsp;! Suivez ces quelques étapes&nbsp;:

1. Assurez-vous de posséder [la dernière version de Firefox](https://www.mozilla.org/fr/firefox/fx/).
2. Installez l'extension [Greasemonkey](https://addons.mozilla.org/fr/firefox/addon/greasemonkey/).
3. Si Firefox vous demande de redémarrer, acceptez.
4. Suivez le lien [HybriDoA.user.js](https://raw.github.com/Watilin/HybriDoA/master/HybriDoA.user.js).
    Greasemonkey détecte alors le script et vous propose de l'installer&nbsp;: acceptez.
5. C'est tout&nbsp;! Vous pouvez jouer immédiatement sur Kabam, le script agit automatiquement.


À tout moment, vous pouvez désactiver ou supprimer HybriDoA s'il ne vous plaît plus, en vous rendant sur la page
des modules complémentaires de Firefox (Contrôle-majuscule-A), sous l'onglet de gestion des userscripts.


Contribuez !
------------

Forkez-moi ! Je suis à l'écoute de toute suggestion.

Voici quelques conseils pour vous y retrouver.

- Les différents fichiers du projet :
    * **hybridoa.user.js** est le fichier principal. Il est documenté à
      l'intérieur.
    * **hybridoa.html** contient la mise en page de remplacement, qui
      est injectée dans le DOM au chargement de la page.
    * **hybridoa.css** est la feuille de style associée.
    * Les fichiers de langue (à venir).
    * Éventuellement des fichiers de modules si le fichier source
      principal devient trop gros. Ils seront concaténés avec un script
      shell.

- Le script tourne en *mode strict*. Plus d'infos :
   * [sur la doc du MSDN (fr)](http://msdn.microsoft.com/fr-fr/library/ie/br230269%28v=vs.94%29.aspx)
   * [sur le blog de John Resig (en)](http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/)

- Je développe avant tout pour Firefox, notamment parce qu'il est le seul (pour l'instant) à fournir l'évènement `beforescriptexecute`. La compatibilité avec Chrome/Chromium n'est pas une priorité pour moi. Si vous souhaitez vous engager dans cette voie, je vous y encourage de tout cœur !
