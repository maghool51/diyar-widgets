(function () {
    "use strict";

    const BASE_URL = "https://maghool51.github.io/diyar-widgets/visitor/";

    function loadFile(type, url, callback) {

        if (type === "css") {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = url;
            document.head.appendChild(link);

            if (callback) callback();
        }

        if (type === "js") {
            const script = document.createElement("script");
            script.src = url;
            script.onload = callback;
            document.body.appendChild(script);
        }
    }


    function createBox() {

        let box = document.getElementById("diyar-visitor-widget");

        if (!box) {

            box = document.createElement("div");
            box.id = "diyar-visitor-widget";

            const currentScript = document.currentScript;

            currentScript.parentNode.insertBefore(
                box,
                currentScript
            );
        }

        return box;
    }


    function init() {

        createBox();

        loadFile(
            "css",
            BASE_URL + "style.css"
        );

        loadFile(
            "js",
            BASE_URL + "widget.js",
            function () {

                if (window.DiyarVisitorWidget) {

                    window.DiyarVisitorWidget.init({
                        target: "diyar-visitor-widget",
                        json: BASE_URL + "stats.json"
                    });

                }

            }
        );

    }


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();

    }

})();
