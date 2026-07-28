/**
 * Diyar Hadith Widget
 * Storage Manager
 * Version 1.0.0
 */

const HadithStorage = {

    prefix: "diyar_hadith_",


    set(key, value) {

        try {

            localStorage.setItem(
                this.prefix + key,
                JSON.stringify(value)
            );

            return true;

        } catch(error) {

            console.error(
                "Storage Save Error:",
                error
            );

            return false;
        }
    },


    get(key) {

        try {

            const data =
            localStorage.getItem(
                this.prefix + key
            );


            return data
            ?
            JSON.parse(data)
            :
            null;


        } catch(error) {

            console.error(
                "Storage Read Error:",
                error
            );

            return null;
        }
    },


    remove(key){

        localStorage.removeItem(
            this.prefix + key
        );

    },


    clear(){

        Object.keys(localStorage)

        .filter(key =>
            key.startsWith(this.prefix)
        )

        .forEach(key =>
            localStorage.removeItem(key)
        );

    }

};
