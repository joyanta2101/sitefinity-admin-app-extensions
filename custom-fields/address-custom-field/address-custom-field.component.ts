import { Component, OnInit, ViewChild, ElementRef } from "@angular/core";
import { FieldBase } from "progress-sitefinity-adminapp-sdk/app/api/v1";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { DynamicScriptLoaderService } from "./script-service";

/*
 * NOTE: Replace this example keys with your subscription keys.
 * For more information on how to get a key check here: https://developer.here.com/?create=Freemium-Basic&keepState=true&step=terms
 */
const HERE_MAPS_APP_ID = 'iV0wv8ievlwH8Fd5Raii';
const HERE_MAPS_APP_CODE = 'AHNPEuMJkSuNjkP7SpW2xg';

const HOST = 'http://autocomplete.geocoder.api.here.com';
const PATH = '/6.2/suggest.json';

declare var H: any;

@Component({
    templateUrl: "./address-custom-field.component.html"
})
export class AddressCustomFieldComponent extends FieldBase implements OnInit {
    @ViewChild("streetAddress") streetAddress: any;
    @ViewChild("mapContainer") mapContainer: ElementRef;

    popupTreeConfig: any;
    searchTerm: string;
    hasSuggestions: Observable<boolean>;
    isPopupVisible: boolean = false;

    private _suggestionsSubject$: BehaviorSubject<any[]>;
    private _suggestions$: Observable<any[]>;

    private hereMap: any;
    private herePlatform: any;
    private hereGeocoder: any;
    private hereGroup: any;
    private hereUI: any;
    private hereBubble: any;

    constructor(private http: HttpClient, private dynamicScriptLoader: DynamicScriptLoaderService) {
        super();

        this._suggestionsSubject$ = new BehaviorSubject<any[]>([]);
        this._suggestions$ = this._suggestionsSubject$.asObservable();
        this.hasSuggestions = this._suggestions$.pipe(map((arr) => { return arr.length > 0;}));
    }

    get suggestions$(): Observable<any[]> {
        return this._suggestions$;
    }

    ngOnInit(): void {
        this.popupTreeConfig = {
            noSelection: true
        };

        this.searchTerm = this.getValue();
        this.loadScripts();
    }

    onFocus(): void {
        if (this.searchTerm !== null) {
            this.isPopupVisible = true;
            this.updateSuggestions();
        }
    }

    onFocusOut(): void {
        this.isPopupVisible = false;
    }

    onNewInputValue(event: Event): void {
        this.clearOldSuggestions();
        this.updateSuggestions();

        setTimeout(() => {
            if (!this.isPopupVisible) {
                this.isPopupVisible = true;
            }
        }, 300);
    }

    onNewItemSelected(event) {
        this.writeValue(JSON.stringify(event.data));
    }

    writeValue(value) {
        if (value && this.isJSON(value)) {
            const realValue = JSON.parse(value);

            if (realValue.label) {
                this.streetAddress.nativeElement.value = realValue.label;
                this.searchTerm = realValue.label;
            }

            // TODO: return lat & long and add them to object
            this.addSuggestionToMap(realValue.locationId);
        }

        super.writeValue(value);
    }

    private addSuggestionToMap(locationId: string) {
        if (this.herePlatform) {
            const geocodingParameters = {
                locationId : locationId
              };

              this.hereGeocoder.geocode(
                  geocodingParameters,
                  (result) => {
                      let marker;
                      const location = result.Response.View[0].Result;

                      marker = new H.map.Marker({
                          lat : location[0].Location.DisplayPosition.Latitude,
                          lng : location[0].Location.DisplayPosition.Longitude
                      });

                      marker.setData(location[0].Location.Address.Label);

                      this.hereGroup.addObject(marker);

                      this.hereMap.setViewBounds(this.hereGroup.getBounds());
                  },
                  () => { });
        }
    }

    private loadScripts() {
        // You can load multiple scripts by just providing the key as argument into load method of the service
        this.dynamicScriptLoader
        .load('here-maps-core', 'here-maps-css')
        .then(() => {
            this.dynamicScriptLoader.load('here-maps-service', 'here-maps-ui', 'here-maps-events').then(data => {
                // Script Loaded Successfully. We should initialize all objects needed
                this.initializeMap();
            });
        });
    }

    private initializeMap() {
        // Step 1: initialize communication with the platform
        this.herePlatform = new H.service.Platform({
            'app_id': HERE_MAPS_APP_ID,
            'app_code': HERE_MAPS_APP_CODE,
            useCIT: false,
            useHTTPS: true
            });

        this.hereGeocoder = this.herePlatform.getGeocodingService();
        this.hereGroup = new H.map.Group();

        this.hereGroup.addEventListener('tap', (event) => {
            this.hereMap.setCenter(event.target.getPosition());
            this.openBubble(event.target.getPosition(), event.target.getData());
        }, false);

        // Obtain the default map types from the platform object
        const defaultLayers = this.herePlatform.createDefaultLayers();

        // Step 2: initialize a map - this map is centered over Europe by default
        // TODO: get default lang and lat from server
        this.hereMap = new H.Map(
            this.mapContainer.nativeElement,
            defaultLayers.normal.map,
            {
                zoom: 3,
                center: { lat: 52.5160, lng: 13.3779 }
            });

        this.hereMap.addObject(this.hereGroup);

        debugger;
        // Step 3: make the map interactive
        // MapEvents enables the event system
        // Behavior implements default interactions for pan/zoom (also on mobile touch environments)
        new H.mapevents.Behavior(new H.mapevents.MapEvents(this.hereMap));

        // Create the default UI components
        this.hereUI = H.ui.UI.createDefault(this.hereMap, defaultLayers);
    }

    /**
     * Removes all H.map.Marker points from the map and adds closes the info bubble
     */
    private clearOldSuggestions(){
        this.hereGroup.removeAll();
        if (this.hereBubble) {
            this.hereBubble.close();
        }
    }

    /**
     * Function to Open/Close an infobubble on the map.
     * @param  {H.geo.Point} position     The location on the map.
     * @param  {String} text              The contents of the infobubble.
     */
    private openBubble(position, text){
        if (!this.hereBubble) {
            this.hereBubble = new H.ui.InfoBubble(
                position,
                {content: '<small>' + text+ '</small>'});
            this.hereUI.addBubble(this.hereBubble);
        } else {
            this.hereBubble.setPosition(position);
            this.hereBubble.setContent('<small>' + text+ '</small>');
            this.hereBubble.open();
        }
   }

    private updateSuggestions() {
        this.getSuggestions(this.searchTerm).subscribe((result: any) => {
            this._suggestionsSubject$.next(result.suggestions);
        });
    }

    private getSuggestions(queryText: string): Observable<object> {
        let queryParams = new HttpParams();
        queryParams = queryParams.append('app_id', HERE_MAPS_APP_ID);
        queryParams = queryParams.append('app_code', HERE_MAPS_APP_CODE);
        queryParams = queryParams.append('query', queryText);

        const url = HOST + PATH;
        return this.http.get(url, { params: queryParams });
    }

    private isJSON(value: string) {
        try {
            JSON.parse(value);
        } catch (e) {
            return false;
        }
        return true;
    }
}