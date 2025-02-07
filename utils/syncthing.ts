import GObject, { register, property, GLib } from "astal/gobject"
import Soup from "gi://Soup?version=3.0"
import { interval } from "astal"

@register({ GTypeName: "Syncthing" })
export default class Syncthing extends GObject.Object {
    static instance: Syncthing
    static soupSession: Soup.Session

    static get_default() {
        if (!this.instance)
            this.instance = new Syncthing()

        return this.instance
    }

    #connected = false

    @property(Boolean)
    get connected() { return this.#connected }

    constructor() {
        super()

        if (!Syncthing.soupSession) 
            Syncthing.soupSession = new Soup.Session();
        

        const message = new Soup.Message({
                method: "GET",
                uri: GLib.Uri.parse("http://localhost:8384/rest/noauth/health", GLib.UriFlags.NONE)
            });
        const decoder = new TextDecoder('utf-8');

        interval(5000, () => {
            let json: { status: string };

            try {
                const response = Syncthing.soupSession.send_and_read(message, null).toArray();
                const responseData = decoder.decode(response);
                json = JSON.parse(responseData);
            } catch (e) {
                if (this.#connected) {
                    this.#connected = false;
                    this.notify("connected");
                }

                return
            }
    
            if (json.status === "OK" && !this.#connected) {
                this.#connected = true;
                this.notify("connected");

                return
            }

            if (json.status !== "OK" && this.#connected) {
                this.#connected = false;
                this.notify("connected");

                return
            }
        });
    }
}