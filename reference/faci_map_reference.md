## Merged Files List
- 1. docs.facilmap.org_developers_.md (3.2 KB)
- 2. docs.facilmap.org_developers_client_.md (8.2 KB)
- 3. docs.facilmap.org_developers_client_events.html.md (8 KB)
- 4. docs.facilmap.org_developers_client_properties.html.md (7.7 KB)
- 5. docs.facilmap.org_developers_embed.html.md (3.9 KB)
- 6. docs.facilmap.org_developers_i18n.html.md (7.1 KB)
- 7. docs.facilmap.org_developers_server_.md (1.3 KB)
- 8. docs.facilmap.org_developers_server_config.html.md (5.5 KB)
- 9. docs.facilmap.org_developers_server_docker.html.md (5.5 KB)
- 10. docs.facilmap.org_developers_server_standalone.html.md (3.6 KB)


## 1. docs.facilmap.org_developers_.md

```md
---
url: "https://docs.facilmap.org/developers/"
title: "Overview | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/\#overview) Overview

## [\#](https://docs.facilmap.org/developers/\#quick-links) Quick links

- [Embed FacilMap](https://docs.facilmap.org/developers/embed.html) into any website using an iframe.
- Run your own [FacilMap server](https://docs.facilmap.org/developers/server/).
- Use the [FacilMap client](https://docs.facilmap.org/developers/client/) to programmatically access and modify data on a collaborative map.
- Use the [Leaflet components](https://docs.facilmap.org/developers/leaflet/) to embed certain feature of FacilMap into a Leaflet map.
- Use the [FacilMap frontend](https://docs.facilmap.org/developers/frontend/) to embed an extended or modified version of FacilMap into a website.
- Read about the [dev setup](https://docs.facilmap.org/developers/development/dev-setup.html) to start contributing to the FacilMap code.

## [\#](https://docs.facilmap.org/developers/\#structural-overview) Structural overview

FacilMap consists of several layers:

- The **Server** is a Node.js app that stores the data of collaborative maps in a database and runs a [socket.ioopen in new window](https://socket.io/) server to access and modify those maps. It also includes a HTTP server that serves the frontend and the map exports.
- The **Client** is a JavaScript library that provides methods to access the data on collaborative maps by sending requests to the socket.io server.
- The **Leaflet components** are a JavaScript library that provides classes to dynamically show the data received by the Client on a [Leafletopen in new window](https://leafletjs.com/) map.
- The **Frontend** is a JavaScript app that provides a complete UI written in [Vue.jsopen in new window](https://vuejs.org/) to create, access and modify collaborative maps. It uses the Client to access those maps and the Leaflet components to render them on a map.

FacilMap is completely written in [TypeScriptopen in new window](https://www.typescriptlang.org/). The code base is split into several NPM modules, each of which can be used independently (although some depend on some others):

- [facilmap-typesopen in new window](https://www.npmjs.com/package/facilmap-types) provides common TypeScript types for map objects and the socket communication and is used by all other modules.
- [facilmap-clientopen in new window](https://www.npmjs.com/package/facilmap-client) contains the [FacilMap client](https://docs.facilmap.org/developers/client/).
- [facilmap-utilsopen in new window](https://www.npmjs.com/package/facilmap-utils) contains helper methods that are used by facilmap-leaflet, facilmap-frontend and facilmap-server, so they can run both in the browser and in Node.js.
- [facilmap-leafletopen in new window](https://www.npmjs.com/package/facilmap-leaflet) contains the [Leaflet components](https://docs.facilmap.org/developers/leaflet/).
- [facilmap-frontendopen in new window](https://www.npmjs.com/package/facilmap-frontend) contains the [Frontend](https://docs.facilmap.org/developers/frontend/).
- [facilmap-serveropen in new window](https://www.npmjs.com/package/facilmap-server) contains the [Server](https://docs.facilmap.org/developers/server/).
```

## 2. docs.facilmap.org_developers_client_.md

```md
---
url: "https://docs.facilmap.org/developers/client/"
title: "Overview | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/client/\#overview) Overview

The FacilMap client makes a connection to the FacilMap server using [socket.ioopen in new window](http://socket.io/). The client serves multiple purposes:

- Proxy to third-party services (find, route and geoip)
- Open a specific collaborative map and receive the objects on it
- Modify the objects on a collaborative map (only if opened through its writable or admin ID)
- Be notified live about changes that other people are making to the collaborative map.

The socket on the server side maintains different API versions in an attempt to stay backwards compatible with older versions of the client. Have a look at the [./changelog.md](https://docs.facilmap.org/developers/client/changelog) to find out what has changed when upgrading to a new version of the client.

## [\#](https://docs.facilmap.org/developers/client/\#setting-it-up) Setting it up

Install facilmap-client as a dependency using npm or yarn:

```bash
npm install -S facilmap-client
```

or import the client from a CDN (only recommended for test purposes):

```html
<script type="module">
	import Client from "https://esm.sh/facilmap-client";
</script>
```

## [\#](https://docs.facilmap.org/developers/client/\#typescript) TypeScript

facilmap-client is fully typed using [TypeScriptopen in new window](https://www.typescriptlang.org/). While facilmap-client can be used in a plain JavaScript app without problems, it is strongly suggested to use TypeScript, as it greatly helps to understand the data types of events, methods and properties and to avoid errors.

## [\#](https://docs.facilmap.org/developers/client/\#usage) Usage

One instance of the client class represents one connection to one specific collaborative map on one specific FacilMap server. The client instance knows different states:

- No map ID set: Only the find, route and geoip methods are available.
- No map ID set and bbox set: Simplified versions of the track points of active routes are sent according to the bbox.
- Map ID set: All methods are available. Events are received when the map settings, types, views and lines (only metadata, not track points) are created/updated/deleted.
- Map ID and bbox set: All methods are available. In addition to the other events, events are received when markers and lines in the specified bounding box are created/updated/deleted.

It is possible to initialize a client without a map ID and later open a map using [`setMapId`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid) or [`createMap`](https://docs.facilmap.org/developers/client/methods.html#createmap-data). Once a specific map is loaded, it is not possible to close it or switch to another map anymore. To do that, a new client instance has to be created.

The bbox can be updated continuously. In the official FacilMap UI, the bbox is updated every time the user pans the map, causing the server to send the markers within that bbox and a simplified version of the line track points and active routes fit to the bbox and zoom level.

### [\#](https://docs.facilmap.org/developers/client/\#open-a-map) Open a map

```javascript
import Client from "facilmap-client";

const client = new Client("https://facilmap.org/");
await client.setMapId("myMapId");
console.log(client.mapData, client.types, client.lines);
```

The client [constructor](https://docs.facilmap.org/developers/client/methods.html#constructor-server-mapid) takes the URL where the FacilMap server is running and opens a socket.io connection to the server.

When opening a collaborative map using [`setMapId`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid), the server sends [events](https://docs.facilmap.org/developers/client/events.html) for the map settings, types, views and lines (without track points). The same types of events will be received later if the respective objects are changed while the connection is open. The client has some default listeners registered that will store the data received as events in its [properties](https://docs.facilmap.org/developers/client/properties.html). For example, a `mapData` event contains the map settings and is emitted the first time the map ID is set and every time the map settings are changed while the connection is open. The `client.mapData` property always contains the latest state of the map settings.

Note that most methods of the client are asynchronous. Events that the server fires in response to a method call are always fired before the method returns. This is why in the above example, `client.mapData` and the other properties are available right after the `setMapId` call.

### [\#](https://docs.facilmap.org/developers/client/\#set-a-bbox) Set a bbox

```javascript
await client.updateBbox({ top: 53.5566, left: 8.7506, right: 19.8468, bottom: 50.1980, zoom: 8 });
console.log(client.markers, client.lines);
```

Setting the bounding box of the client will cause the server to send events for all the markers within these bounds, and also for any line track points within the bounds, simplified to be appropriate for the specified zoom level. It will also subscribe to any updates to those objects within the bbox.

The bbox can be updated again later to receive the data and change the subscription to objects in that bounding box. (Note that when changing the bounding box, the server will not send events again for objects that were already sent as part of the previous bounding box.)

### [\#](https://docs.facilmap.org/developers/client/\#change-the-map) Change the map

```javascript
const newMarker = client.editMarker({ id: 123, title: "New title" });
```

When creating/updating/deleting an object, the data is propagated in multiple ways:

- An event representing the change is fired before the method returns (in the above example, a `marker` event)
- The client property is updated in reaction to the event (in the above example, the updated marker is stored in `client.markers[123]`)
- The method returns the created/updated object.

Note that creating/updating/deleting an object will fail if the operation is not permitted. The above example will fail if the map was opened using its read-only ID.

### [\#](https://docs.facilmap.org/developers/client/\#internationalization) Internationalization

Most of the data returned by the client is user-generated and thus not internationalized. There are a few exceptions though, in particular error messages in case someting unexpected happens.

By default, the FacilMap backend detects the user language based on the `Accept-Language` HTTP header. The detected language can be overridden by setting a `lang` cookie or query parameter. In addition, a `units` cookie or query parameter can be set to `metric` or `us_customary`.

For the websocket, the `Accept-Language` header, cookies and query parameters are sent during the socket.io handshake. If you want to force the socket to use a sepcific language, you can pass query parameters through the third parameter of the client constructor:

```javascript
import Client from "facilmap-client";

const client = new Client("https://facilmap.org/", undefined, {
	query: {
		lang: "en",
		units: "us_customary"
	}
});
```

You can also update the internationalization settings for an existing socket connection at any point using [`setLanguage()`](https://docs.facilmap.org/developers/client/methods#setlanguage-settings).

### [\#](https://docs.facilmap.org/developers/client/\#deal-with-connection-problems) Deal with connection problems

```javascript
const client = new Client("https://facilmap.org/");
client.on("connect", () => {
	console.log("connected");
});
client.on("disconnect", () => {
	console.log("disconnected");
});
```

Constructing the client will attempt to connect to the server. socket.io will retry this until it succeeds. Once the connection is made, a `connect` event is fired.

If the connection is lost at some point, a `disconnect` event is fired and socket.io will keep trying to connect again. When it succeeds, a `connect` event is fired again. Since the session on the server is lost when disconnecting, the client will automatically set the last map ID, bbox and routes again on reconnection. This means that events for all the map objects are received again.
```

## 3. docs.facilmap.org_developers_client_events.html.md

```md
---
url: "https://docs.facilmap.org/developers/client/events.html"
title: "Events | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/client/events.html\#events) Events

The FacilMap server uses events to send information about objects on a collaborative map to the client. The events are fired when the client opens a map or a particular section of a map for the first time, and whenever an object is changed on the map (including when the change is made by the same instance of the client). The client has some listeners already attached to most events and uses them to persist and update the received objects in its [properties](https://docs.facilmap.org/developers/client/properties.html).

Note that events are always fired _before_ the method causing them returns. For example, when updating a marker using the `editMarker()` method, a `marker` event with the updated marker is fired first (if the marker is within the current bbox), and only then the method returns the updated marker as well.

Subscribe to events using the [`on(eventName, function)`](https://docs.facilmap.org/developers/client/methods.html#on-eventname-function) method. Example:

```javascript
const client = new FacilMap.Client("https://facilmap.org/", "testMap");
client.on("mapData", (mapData) => {
	document.title = mapData.name;
});
```

## [\#](https://docs.facilmap.org/developers/client/events.html\#connect-disconnect-connect-error-error-reconnect-reconnect-attempt-reconnect-error-reconnect-failed)`connect`, `disconnect`, `connect_error`, `error`, `reconnect`, `reconnect_attempt`, `reconnect_error`, `reconnect_failed`

These events come from socket.io and are [documented thereopen in new window](https://socket.io/docs/v4/client-api/#events).

## [\#](https://docs.facilmap.org/developers/client/events.html\#mapdata)`mapData`

The settings of the map have changed or are retrieved for the first time.

Note that when this event is fired, the read-only and/or the read-write ID of the map might have changed. The [`mapId`](https://docs.facilmap.org/developers/client/properties.html#mapid) property is updated automatically.

_Type:_ [MapData](https://docs.facilmap.org/developers/client/types.html#mapdata)

## [\#](https://docs.facilmap.org/developers/client/events.html\#servererror)`serverError`

[`setMapId()`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid) failed and the map could not be opened.

_Type:_ Error

## [\#](https://docs.facilmap.org/developers/client/events.html\#deletepad)`deletePad`

The map has been deleted.

## [\#](https://docs.facilmap.org/developers/client/events.html\#marker)`marker`

An existing marker is retrieved for the first time, has been modified, or a new marker has been created in the current bbox.

_Type:_ [Marker](https://docs.facilmap.org/developers/client/types.html#marker)

## [\#](https://docs.facilmap.org/developers/client/events.html\#deletemarker)`deleteMarker`

A marker has been removed. This event is emitted for all markers on the map, even if they are outside of the current bbox (in case that a marker outside of the current bbox is cached).

_Type:_`{ id: number }`

## [\#](https://docs.facilmap.org/developers/client/events.html\#line)`line`

An existing line is retrieved for the first time, has been modified, or a new line has been created. Note that line objects only contain the line metadata, not its track points (those are handled separately as `linePoints`). This is why all line objects of the map are sent to the client, regardless of the current bbox.

_Type:_ [Line](https://docs.facilmap.org/developers/client/types.html#line) (without trackPoints)

## [\#](https://docs.facilmap.org/developers/client/events.html\#deleteline)`deleteLine`

A line has been removed.

_Type:_`{ id: number }`

## [\#](https://docs.facilmap.org/developers/client/events.html\#linepoints)`linePoints`

New track points for an existing line are retrieved after a change of bbox (`reset == false`), or the line has been modified, so the new track points are retrieved (`reset == true`).

_Type:_ object with the following properties:

- **id** (number): The ID of the line that these track points belong to
- **reset** (boolean): Whether to remove all cached track points for this line (`true`) or to merge these track points with the cached ones (`false`).
- **trackPoints** (Array< [TrackPoint](https://docs.facilmap.org/developers/client/types.html#trackpoint) >): The track points

## [\#](https://docs.facilmap.org/developers/client/events.html\#view)`view`

A view is retrieved for the first time, has been modified, or a new view has been created.

_Type:_ [View](https://docs.facilmap.org/developers/client/types.html#view)

## [\#](https://docs.facilmap.org/developers/client/events.html\#deleteview)`deleteView`

A view has been removed.

_Type:_`{ id: number }`

## [\#](https://docs.facilmap.org/developers/client/events.html\#type)`type`

A type is retrieved for the first time, has been modified, or a new type has been created.

_Type:_ [Type](https://docs.facilmap.org/developers/client/types.html#type)

## [\#](https://docs.facilmap.org/developers/client/events.html\#deletetype)`deleteType`

A type has been removed.

_Type:_`{ id: number }`

## [\#](https://docs.facilmap.org/developers/client/events.html\#history)`history`

An entry of the modification history is retrieved for the first time, or a new entry has been created due to something being modified. Note that this event is only fired when the client has subscribed using [`listenToHistory()`](https://docs.facilmap.org/developers/client/methods.html#listentohistory).

_Type:_ [historyEntry](https://docs.facilmap.org/developers/client/types.html#historyentry)

## [\#](https://docs.facilmap.org/developers/client/events.html\#route)`route`

A new route has been set.

_Type:_ [Route](https://docs.facilmap.org/developers/client/types.html#route) \> with trackpoints for the current bbox. The `routeId` property identifies the route (can be a string or undefined).

## [\#](https://docs.facilmap.org/developers/client/events.html\#clearroute)`clearRoute`

A route has been cleared.

_Type:_`{ routeId: string | undefined }`

## [\#](https://docs.facilmap.org/developers/client/events.html\#routepoints)`routePoints`

New track points for the default route (route that has been set using [`setRoute()`](https://docs.facilmap.org/developers/client/methods.html#setroute-data) without a `routeId`) are retrieved after a change of bbox.

_Type:_ Array< [TrackPoint](https://docs.facilmap.org/developers/client/types.html#trackpoint) >

## [\#](https://docs.facilmap.org/developers/client/events.html\#routepointswithid)`routePointsWithId`

New track points for a route with a `routeId` are retrieved after a change of bbox.

_Type:_ object with the following properties:

- **routeId** (string): The `routeId` that was passed when setting the route using [`setRoute()`](https://docs.facilmap.org/developers/client/methods.html#setroute-data)
- **trackPoints** (`Array<[trackPoint](./types.md#trackpoint)>`): The additional track points for the route

## [\#](https://docs.facilmap.org/developers/client/events.html\#loadstart-loadend)`loadStart`, `loadEnd`

This event is fired every time some request is sent to the server and when the response has arrived. It can be used to display a loading indicator to the user. Note that multiple things can be loading at the same time. Example code:

```javascript
let loading = 0;
client.on("loadStart", () => {
	++loading;
	showLoadingIndicator();
});
client.on("loadEnd", () => {
	if(--loading == 0)
		hideLoadingIndicator();
});
```

## [\#](https://docs.facilmap.org/developers/client/events.html\#emit-emitresolve-emitreject)`emit`, `emitResolve`, `emitReject`

`emit` is emitted by the client whenever any request is sent to the server, and `emitResolve` or `emitReject` is emitted when the request is answered. These can be used to hook into the communication between the client and the server. All 3 events are called with two arguments, the first one being the request name and the second one being the request data, response data or error.
```

## 4. docs.facilmap.org_developers_client_properties.html.md

```md
---
url: "https://docs.facilmap.org/developers/client/properties.html"
title: "Properties | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/client/properties.html\#properties) Properties

All objects that are received from the server are cached in properties of the client object.

All objects that can be part of a map have an `id`. Note that when an object is updated, the whole object is replaced in these properties, so be careful to not cache outdated versions of objects:

```javascript
let myMarker = client.markers[myMarkerId];
setTimeout(() => {
	// Bad! A client.markers[myMarkerId] might have been replaced if the marker
	// has been changed in the meantime, and we are using the old version.
	doSomethingWithMarker(myMarker);
}, 10000);

setTimeout(() => {
	// Better! Always get objects directly from the client cache.
	doSomethingWithMarker(client.markers[myMarkerId]);
});

// If you need to keep an object copy, make sure to keep it updated
client.on("marker", (marker) => {
	if(marker.id == myMarkerId)
		myMarker = marker;
});
```

## [\#](https://docs.facilmap.org/developers/client/properties.html\#mapid)`mapId`

The ID of the collaborative map that the client is connected to. Can be the read-only, writable or admin ID of an existing map.

Note that the ID can be changed in the settings. If in case of a [`mapData`](https://docs.facilmap.org/developers/client/events.html#mapdata) event, the ID of the map has changed, this property is updated automatically.

_Set:_ when calling [`setMapId`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid) and in response to a [`mapData`](https://docs.facilmap.org/developers/client/events.html#mapdata) event.

_Type:_ string

## [\#](https://docs.facilmap.org/developers/client/properties.html\#readonly)`readonly`

`true` if the map has been opened using its read-only ID. `false` if the map is writable.

_Set:_ during [`setMapId`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid).

_Type:_ boolean

## [\#](https://docs.facilmap.org/developers/client/properties.html\#writable)`writable`

`2` if the map has been opened using its admin ID, `1` if if has been opened using the writable ID, `0` if the map is read-only.

_Set:_ during [`setMapId`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid).

_Type:_ number

## [\#](https://docs.facilmap.org/developers/client/properties.html\#deleted)`deleted`

`true` if the map was deleted while this client was connected to it.

_Set:_ in response to a [`deleteMap`](https://docs.facilmap.org/developers/client/events.html#deletemap) event.

_Type:_ boolean

## [\#](https://docs.facilmap.org/developers/client/properties.html\#mapdata)`mapData`

The current settings of the map. `writeId` and/or `adminId` is null if if has been opened using another ID than the admin ID.

_Set:_ in response to a [`mapData`](https://docs.facilmap.org/developers/client/events.html#mapdata) event.

_Type:_ [MapData](https://docs.facilmap.org/developers/client/types.html#mapdata)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#markers)`markers`

All markers that have been retrieved so far.

_Set:_ in response to [`marker`](https://docs.facilmap.org/developers/client/events.html#marker) and [`deleteMarker`](https://docs.facilmap.org/developers/client/events.html#deletemarker) events.

_Type:_ [`{ [markerId: number]: Marker }`](https://docs.facilmap.org/developers/client/types.html#marker)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#lines)`lines`

All lines of the map along with the track points that have been retrieved so far.

_Set:_ in response to [`line`](https://docs.facilmap.org/developers/client/events.html#line), [`linePoints`](https://docs.facilmap.org/developers/client/events.html#linepoints) and [`deleteLine`](https://docs.facilmap.org/developers/client/events.html#deleteline) events.

_Type:_ [`{ [lineId: number]: Line }`](https://docs.facilmap.org/developers/client/types.html#line) (with track points)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#views)`views`

All views of the map.

_Set:_ in response to [`view`](https://docs.facilmap.org/developers/client/events.html#view) and [`deleteView`](https://docs.facilmap.org/developers/client/events.html#deleteview) events.

_Type:_ [`{ [viewId: number]: View }`](https://docs.facilmap.org/developers/client/types.html#view)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#types)`types`

All types of the map.

_Set:_ in response to [`type`](https://docs.facilmap.org/developers/client/events.html#type) and [`deleteType`](https://docs.facilmap.org/developers/client/events.html#deletetype) events.

_Type:_ [`{ [typeId: number]: Type }`](https://docs.facilmap.org/developers/client/types.html#type)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#history)`history`

All history entries that have been retrieved so far. Note that you have to subscribe to the history using [`listenToHistory()`](https://docs.facilmap.org/developers/client/methods.html#listentohistory).

_Set:_ in response to [`history`](https://docs.facilmap.org/developers/client/events.html#history) events.

_Type:_ [`{ [entryId: number]: HistoryEntry }`](https://docs.facilmap.org/developers/client/types.html#historyentry)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#route)`route`

Details and track points (simplified for the current bbox) for the active route set using [`setRoute()`](https://docs.facilmap.org/developers/client/methods.html#setroute-data) with `routeId` set to `undefined`, or `undefined` if no such route is active.

_Set:_ during [`setRoute()`](https://docs.facilmap.org/developers/client/methods.html#setroute-data) and in response to [`routePoints`](https://docs.facilmap.org/developers/client/events.html#routepoints) events.

_Type:_ [`Route`](https://docs.facilmap.org/developers/client/types.html#route)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#routes)`routes`

Details and track points (simplified for the current bbox) for the active routes set using [`setRoute()`](https://docs.facilmap.org/developers/client/methods.html#setroute-data) with `routeId` set to a string.

_Set:_ during [`setRoute()`](https://docs.facilmap.org/developers/client/methods.html#setroute-data) and in response to [`routePoints`](https://docs.facilmap.org/developers/client/events.html#routepoints) events.

_Type:_ [`{ [routeId: string]: Route }`](https://docs.facilmap.org/developers/client/types.html#route)

## [\#](https://docs.facilmap.org/developers/client/properties.html\#servererror)`serverError`

If the opening the map failed ( [`setMapId(mapId)`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid) promise got rejected), the error message is stored in this property.

_Set:_ in response to a [`serverError`](https://docs.facilmap.org/developers/client/events.html#servererror) event (fired during [`setMapId`](https://docs.facilmap.org/developers/client/methods.html#setmapid-mapid)).

_Type:_ Error

## [\#](https://docs.facilmap.org/developers/client/properties.html\#loading)`loading`

A number that indicates how many requests are currently pending (meaning how many async methods are currently running). You can use this to show a loading spinner or disable certain UI elements while the value is greater than 0.

_Set:_ increased when any method is called and decreased when the method returns.

_Type:_`number`

## [\#](https://docs.facilmap.org/developers/client/properties.html\#disconnected)`disconnected`

`false` in the beginning, changed to `true` as soon as the socket.io connection is made. May be `false` temporarily if the connection is lost.

_Set:_ in reaction to `connect` and `disconnect` events.

_Type:_`boolean`
```

## 5. docs.facilmap.org_developers_embed.html.md

```md
---
url: "https://docs.facilmap.org/developers/embed.html"
title: "Embed FacilMap | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/embed.html\#embed-facilmap) Embed FacilMap

You can embed a map into any website using an iframe:

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
```

If you use a map ID that does not exist yet, the “Create Collaborative Map” dialog will be opened when accessing the map (unless the `interactive` parameter is `false`).

## [\#](https://docs.facilmap.org/developers/embed.html\#options) Options

You can control the display of different components by using the following query parameters:

- `toolbox`: Show the toolbox (default: `true`)
- `search`: Show the search box (default: `true`)
- `route`: Show the route tab in the search box (default: `true`)
- `pois`: Show the POIs tab in the search box (default: `true`)
- `autofocus`: Autofocus the search field (default: `false`)
- `legend`: Show the legend if available (default: `true`)
- `locate`: Show the locate control to zoom to the user’s location (default: `true`)
- `interactive`: Enable [interactive mode](https://docs.facilmap.org/developers/embed.html#interactive-mode) (default: `false`)
- `lang`: Use this display language (for example `en`) by default, instead of the language set by the user in the user preferences dialog or in their browser.
- `units`: Use this type of units (either `metric` or `us_customary`) by default, instead of what the user has configured in the user preferences dialog.

Example:

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap?search=false&amp;toolbox=false"></iframe>
```

## [\#](https://docs.facilmap.org/developers/embed.html\#interactive-mode) Interactive mode

When embedding FacilMap into a website, you may want to disable certain UI interactions that make more sense when FacilMap runs as a standalone app. For example, when you want to embed a specific collaborative map, you may want to disable any interactions that will navigate the user away from the map, such as closing the map or navigating to a bookmark. Disabling interactive mode will hide the following UI interactions:

- “Collaborative map” menu in the toolbox, including bookmarks, the “Open collaborative map” dialog and “Close current map”.
- “Share” dialog.
- “Open file” or dragging a geographic file onto the map.
- “Create collaborative map” dialog when opening a map ID that does not exist.
- “Close map” button when the open map is deleted.

## [\#](https://docs.facilmap.org/developers/embed.html\#location-hash) Location hash

When a FacilMap is opened directly in the browser, the current view of the map is [added to the location hash](https://docs.facilmap.org/users/share/) (the part after the `#` in the URL). This means that users can easily share the current view by copying the URL straight from the address bar of their browser, and reloading the page will not cause the current view to be lost.

FacilMap emits a [cross-origin messageopen in new window](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) every time it updates the location map. You can listen to it to synchronize the location hash of your website with the one of FacilMap by using the following script:

```html
<iframe id="facilmap" style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
<script>
	window.addEventListener("message", function(evt) {
		if(evt.data && evt.data.type == "facilmap-hash" && location.hash != "#" + evt.data.hash)
			location.replace("#" + evt.data.hash);
	});

	function handleHashChange() {
		var iframe = document.getElementById("facilmap");
		iframe.src = iframe.src.replace(/(#.*)?$/, "") + location.hash;
	}

	window.addEventListener("hashchange", handleHashChange);
	if (location.hash)
		handleHashChange();
</script>
```
```

## 6. docs.facilmap.org_developers_i18n.html.md

```md
---
url: "https://docs.facilmap.org/developers/i18n.html"
title: "I18n | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/i18n.html\#i18n) I18n

FacilMap uses [i18nextopen in new window](https://www.i18next.com/) for internationalization throughout the frontend, the server and its libraries. It detects the desired user language like this:

- In the browser, [i18next-browser-languageDetectoropen in new window](https://github.com/i18next/i18next-browser-languageDetector) is used to detect the user’s language. It looks at the configured browser languages ( [`navigator.languages`open in new window](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages)) and checks for which one a translation exists. The configured language can be overridden by setting a `lang` cookie or appending a `?lang=` query parameter to the URL.
- On the server, when a request is handled through HTTP (including the WebSocket), [i18next-http-middlewareopen in new window](https://www.npmjs.com/package/i18next-http-middleware) is used to detect the user’s language. It looks at the configured browser languages ( [`Accept-Language`open in new window](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)) and checks for which one a translation exists. The configured language can be overridden by setting a `lang` cookie or by appending a `?lang=` query parameter to the URL. The server stores the selected language in the [Node.js domainopen in new window](https://nodejs.org/api/domain.html) that is created for each incoming request, causing all functions triggered (sync or async) from the request to use the language setting of the request.
- On the sever, when a function is called outside of an incoming HTTP request, messages are not internationalized and output in English.

In addition, certain values can be shown in metric units or in US customary units. By default, metric units are used. This can be changed by sending a `units` query parameter or cookie with the value `us_customary`.

Translations are managed on [Weblateopen in new window](https://hosted.weblate.org/projects/facilmap/), changes there automatically trigger a pull request to the FacilMap repository.

## [\#](https://docs.facilmap.org/developers/i18n.html\#use-facilmap-in-an-app-not-using-i18next) Use FacilMap in an app not using i18next

When you import any of the FacilMap modules into a JavaScript app that does not use i18next, they will automatically detect the user language and internationalize their output accordingly as described above.

The main instance of i18next is [initializedopen in new window](https://www.i18next.com/overview/api#init) by FacilMap as soon as the first message is internationalized. This that before calling any of the functions exported by FacilMap, you can still change the i18next configuration.

### [\#](https://docs.facilmap.org/developers/i18n.html\#change-the-language-detector) Change the language detector

To change the detected user language, you have two options. As mentioned above, both options need to be executed before calling any FacilMap functions that generate internationalized messages.

Option 1 is to set a custom [language detectoropen in new window](https://www.i18next.com/overview/plugins-and-utils#language-detector) using the `setLanguageDetector()` function exported by `facilmap-utils`. This language detector is applied to the `i18next` main instance when it is initialized instead of the default language detector used by FacilMap.

```typescript
import { setLanguageDetector } from "facilmap-utils";

setLanguageDetector(myLanguageDetector);
```

Option 2 is to set a custom [i18next instanceopen in new window](https://www.i18next.com/overview/api#instance-creation) that will be used by FacilMap. In this example, we are disabling the language detector and use a custom i18next instance that always uses German:

```typescript
import { setLanguageDetector, setI18nGetter } from "facilmap-utils";
import { createInstance } from "i18next";

setLanguageDetector(undefined);
setI18nGetter(() => createInstance({ lng: "de" }));
```

### [\#](https://docs.facilmap.org/developers/i18n.html\#use-the-backend-language-detector) Use the backend language detector

If you are including some of FacilMap’s server modules in your own Node.js express server and want messages to be internationalized according to the user language as described above, you need to add FacilMap’s `i18nMiddleware` to your express server:

```typescript
import express from "express";
import domainMiddleware from "express-domain-middleware";
import { i18nMiddleware } from "facilmap-server";

const app = express();
app.use(domainMiddleware);
app.use(i18nMiddleware);
```

As seen in the example, `i18nMiddleware` requires [express-domain-middlewareopen in new window](https://www.npmjs.com/package/express-domain-middleware) to be initialized before it.

## [\#](https://docs.facilmap.org/developers/i18n.html\#use-facilmap-in-an-app-already-using-i18next) Use FacilMap in an app already using i18next

When you use FacilMap’s modules in an app that is already using i18next, you may want FacilMap to reuse your existing i18n configuration (such as language detection), or you may want it to use its own configuration independently from yours.

When a FacilMap function internationalizes a message for the first time, it initializes i18next in the following way:

1. It retrieves the i18next instance set through `setI18nGetter()` (exported by `facilmap-utils`). If no instance was set, it defaults to the i18next main instance (`import i18next from "i18next"`).
2. If the instance is not initialized yet (`!i18next.isInitializing && !i18next.isInitialized`), it initializes it with its default configuration (language detector as described above).
3. It adds its resources to the instance under namespaces prefixed by `facilmap-`.

### [\#](https://docs.facilmap.org/developers/i18n.html\#reuse-your-i18next-instance-for-facilmap) Reuse your i18next instance for FacilMap

You can make FacilMap reuse your existing i18next instance and configuration in the following way:

- Make sure your i18next instance is initialized before you call any FacilMap functions that need to internationalize messages.
- Call `setI18nGetter()` with a callback that returns your i18next instance (can be skipped if you are using the main instance).

```typescript
import { setLanguageDetector, setI18nGetter } from "facilmap-utils";
import { createInstance } from "i18next";

const i18next = createInstance();
await i18next.init({
	lng: "en"
});
setI18nGetter(() => i18next);
```

### [\#](https://docs.facilmap.org/developers/i18n.html\#use-a-separate-i18next-instance-for-facilmap) Use a separate i18next instance for FacilMap

If you want to make FacilMap use a separate i18next instance, for example because you want to keep your and FacilMap’s language detection independent, use the following example:

```typescript
import { setI18nGetter } from "facilmap-utils";
import { createInstance } from "i18next";

setLanguageDetector(undefined);
setI18nGetter(() => createInstance());
```

Because the instance returned by `createInstance()` is not initialized, FacilMap will initialize it using its default configuration.
```

## 7. docs.facilmap.org_developers_server_.md

```md
---
url: "https://docs.facilmap.org/developers/server/"
title: "Overview | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/server/\#overview) Overview

The FacilMap server is a HTTP server that fulfills the following tasks:

- Serve the frontend under `/` and `/<map ID>`.
- Serve exported collaborative maps under `/<map ID>/<type>`, where `<type>` can be `table`, `gpx` or `geojson`.
- Run a socket.io server under `/socket.io`. The frontend connects to this using the [FacilMap client](https://docs.facilmap.org/developers/client/) and uses it to get calculated routes, get and update the data on a collaborative map, and receive live updates to a collaborative map, and as a proxy to perform searches.
- Maintain a connection to a database where collaborative map data and calculated routes are stored.

The official FacilMap server is running on [https://facilmap.org/open in new window](https://facilmap.org/). If you want, you can run your own FacilMap server using one of these options:

- [Docker](https://docs.facilmap.org/developers/server/docker.html) will run the server in an isolated container. It is easer to set up and more secure, but takes more resources.
- Running the server [standalone](https://docs.facilmap.org/developers/server/standalone.html) takes less resources, but is less secure and takes more steps to set up.
```

## 8. docs.facilmap.org_developers_server_config.html.md

```md
---
url: "https://docs.facilmap.org/developers/server/config.html"
title: "Configuration | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/server/config.html\#configuration) Configuration

The config of the FacilMap server can be set either by using environment variables (useful for docker) or by editing `config.env`.

| Variable | Required | Meaning |
| --- | --- | --- |
| `USER_AGENT` | \* | Will be used for all HTTP requests (search, routing, GPX/KML/OSM/GeoJSON files). You better provide your e-mail address in here. |
| `APP_NAME` |  | If specified, will replace “FacilMap” as the name of the app throughout the UI. |
| `TRUST_PROXY` |  | Whether to trust the X-Forwarded-\* headers. Can be `true` or a comma-separated list of IP subnets (see the [express documentationopen in new window](https://expressjs.com/en/guide/behind-proxies.html)). Currently only used to calculate the base URL for the `opensearch.xml` file. |
| `BASE_URL` |  | If `TRUST_PROXY` does not work for your particular setup, you can manually specify the base URL where FacilMap can be publicly reached here. |
| `HOST` |  | The ip address to listen on (leave empty to listen on all addresses) |
| `PORT` |  | The port to listen on.<br>_Default:_`8080` |
| `DB_TYPE` |  | The type of database. Either `mysql`, `postgres`, `mariadb`, `sqlite`, or `mssql`.<br>_Default:_`mysql` |
| `DB_HOST` |  | The host name of the database server.<br>_Default:_`localhost` |
| `DB_PORT` |  | The port of the database server (optional). |
| `DB_NAME` |  | The name of the database.<br>_Default:_`facilmap` |
| `DB_USER` |  | The username to connect to the database with.<br>_Default:_`facilmap` |
| `DB_PASSWORD` |  | The password to connect to the database with.<br>_Default:_`facilmap` |
| `ORS_TOKEN` |  | [OpenRouteService API keyopen in new window](https://openrouteservice.org/). If not specified, advanced routing settings will not be shown. |
| `MAPBOX_TOKEN` |  | [Mapbox API keyopen in new window](https://www.mapbox.com/signup/). If neither this nor `ORS_TOKEN` are specified, the routing tab and any routing options will be hidden. |
| `MAXMIND_USER_ID` |  | [MaxMind user IDopen in new window](https://www.maxmind.com/en/geolite2/signup). |
| `MAXMIND_LICENSE_KEY` |  | MaxMind license key. |
| `LIMA_LABS_TOKEN` |  | [Lima Labsopen in new window](https://maps.lima-labs.com/) API key (for Lima Labs map style) |
| `THUNDERFOREST_TOKEN` |  | [Thunderforestopen in new window](https://www.thunderforest.com/) API key (for OpenCycleMap map style) |
| `TRACESTRACK_TOKEN` |  | [Tracestrackopen in new window](https://tracestrack.com/) API key (for Tracestrack Topo map style) |
| `HIDE_COMMERCIAL_MAP_LINKS` |  | Set to `1` to hide the links to Google/Bing Maps in the “Map style” menu. |
| `CUSTOM_CSS_FILE` |  | The path of a CSS file that should be included ( [see more details below](https://docs.facilmap.org/developers/server/config.html#custom-css-file)). |
| `NOMINATIM_URL` |  | The URL to the Nominatim server (used to search for places).<br>_Default:_`https://nominatim.openstreetmap.org` |
| `OPEN_ELEVATION_URL` |  | The URL to the Open Elevation server (used to look up the elevation for markers).<br>_Default:_`https://api.open-elevation.com` |
| `OPEN_ELEVATION_THROTTLE_MS` |  | The minimum time between two requests to the Open Elevation API. Set to `0` if you are using your own self-hosted instance of Open Elevation.<br>_Default:_`1000` |
| `OPEN_ELEVATION_MAX_BATCH_SIZE` |  | The maximum number of points to resolve in one request through the Open Elevation API. Set this to `1000` if you are using your own self-hosted Open Elevation instance.<br>_Default:_`200` |
| `DONATE_URL` |  | Define a custom target for the “Donate” button. If you decide to link your own donation page to cover the costs of your hosting, consider mentioning FacilMap’s donation page there for the costs of the development of the software. You can also set this to an empty string to completely hide the donation button.<br>_Default:_`https://docs.facilmap.org/users/contribute/` |

FacilMap makes use of several third-party services that require you to register (for free) and generate an API key:

- Mapbox and OpenRouteService are used for calculating routes. Mapbox is used for basic routes, OpenRouteService is used when custom route mode settings are made. If these API keys are not defined, calculating routes will fail.
- Maxmind provides a free database that maps IP addresses to approximate locations. FacilMap downloads this database to decide the initial map view for users (IP addresses are looked up in FacilMap’s copy of the database, on IP addresses are sent to Maxmind). This API key is optional, if it is not set, the default view will be the whole world.
- Lima Labs is used for nicer and higher resolution map tiles than Mapnik. The API key is optional, if it is not set, Mapnik will be the default map style instead.

## [\#](https://docs.facilmap.org/developers/server/config.html\#custom-css-file) Custom CSS file

To include a custom CSS file in the UI, set the `CUSTOM_CSS_FILE` environment variable to the file path.

When running FacilMap with docker, you can mount your CSS file as a volume into the container, for example with the following docker-compose configuration:

```yaml
		environment:
			CUSTOM_CSS_FILE: /opt/facilmap/custom.css
		volumes:
			- ./custom.css:/opt/facilmap/custom.css
```

Your custom CSS file will be included in the map UI and in the table export. You can distinguish between the two by using the `html.fm-facilmap-map` and `html.fm-facilmap-table` selectors.
```

## 9. docs.facilmap.org_developers_server_docker.html.md

```md
---
url: "https://docs.facilmap.org/developers/server/docker.html"
title: "Docker | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/server/docker.html\#docker) Docker

[Dockeropen in new window](https://www.docker.com/) is a container management system that is commonly used to run applications on servers. A docker image contains a full Linux system with one particular application installed, and docker runs this in a simulated virtual environment that is isolated from the rest of the server. The main advantages are security (if a hacker gains access to an application that is running inside a docker container is hacked, it is hard to impossible to gain access to the rest of the system from there) and simplicity (applications can be installed, updated and removed without leaving any traces behind using a single command).

This manual assumes that you have docker set up on your system.

The FacilMap server is available as [`facilmap/facilmap`open in new window](https://hub.docker.com/r/facilmap/facilmap/) on Docker Hub. The [configuration](https://docs.facilmap.org/developers/server/config.html) can be defined using environment variables. The container will expose a HTTP server on port 8080, which you should put behind a reverse proxy such as [nginx-proxyopen in new window](https://hub.docker.com/r/jwilder/nginx-proxy) or [traefikopen in new window](https://traefik.io/traefik/) for HTTPS support.

FacilMap needs a database supported by [Sequelizeopen in new window](https://sequelize.org/master/) to run, it is recommended to use MySQL/MariaDB. When creating a MySQL/MariaDB database for FacilMap, make sure to use the `utf8mb4` charset/collation to make sure that characters from all languages can be used on a map. By default, MySQL/MariaDB uses the `latin1` charset, which mostly supports only basic latin characters. When you start the FacilMap server for the first time, the necessary tables are created using the charset of the database. When using PostgreSQL, the PostGIS extensions must be enabled.

## [\#](https://docs.facilmap.org/developers/server/docker.html\#docker-compose) docker-compose

To run FacilMap with MariaDB using [docker-composeopen in new window](https://docs.docker.com/compose/), here is an example `docker-compose.yml`:

```yaml
services:
    facilmap:
        image: facilmap/facilmap
        ports:
            - 8080:8080
        links:
            - mariadb
        depends_on:
            mariadb:
                condition: service_healthy
        environment:
            USER_AGENT: My FacilMap (https://facilmap.example.org/, facilmap@example.org)
            TRUST_PROXY: "true"
            DB_TYPE: mysql
            DB_HOST: mariadb
            DB_NAME: facilmap
            DB_USER: facilmap
            DB_PASSWORD: password
            ORS_TOKEN: # Get an API key on https://go.openrouteservice.org/ (needed for routing)
            MAPBOX_TOKEN: # Get an API key on https://www.mapbox.com/signup/ (needed for routing)
            MAXMIND_USER_ID: # Sign up here https://www.maxmind.com/en/geolite2/signup (needed for geoip lookup to show initial map state)
            MAXMIND_LICENSE_KEY:
            LIMA_LABS_TOKEN: # Get an API key on https://maps.lima-labs.com/ (optional, needed for double-resolution tiles)
        volumes:
            - ./cache:/opt/facilmap/cache
        restart: always
    mariadb:
        image: mariadb
        environment:
            MYSQL_DATABASE: facilmap
            MYSQL_USER: facilmap
            MYSQL_PASSWORD: password
            MYSQL_RANDOM_ROOT_PASSWORD: "true"
        command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
        healthcheck:
            test: healthcheck.sh --su-mysql --connect --innodb_initialized
        restart: always
```

Here is an example with Postgres:

```yaml
services:
    facilmap:
        image: facilmap/facilmap
        ports:
            - 8080:8080
        links:
            - postgres
        depends_on:
            postgres:
                condition: service_healthy
        environment:
            USER_AGENT: My FacilMap (https://facilmap.example.org/, facilmap@example.org)
            TRUST_PROXY: "true"
            DB_TYPE: postgres
            DB_HOST: db
            DB_NAME: facilmap
            DB_USER: facilmap
            DB_PASSWORD: password
            ORS_TOKEN: # Get an API key on https://go.openrouteservice.org/ (needed for routing)
            MAPBOX_TOKEN: # Get an API key on https://www.mapbox.com/signup/ (needed for routing)
            MAXMIND_USER_ID: # Sign up here https://www.maxmind.com/en/geolite2/signup (needed for geoip lookup to show initial map state)
            MAXMIND_LICENSE_KEY:
            LIMA_LABS_TOKEN: # Get an API key on https://maps.lima-labs.com/ (optional, needed for double-resolution tiles)
        volumes:
            - ./cache:/opt/facilmap/cache
        restart: always
    postgres:
        image: postgis/postgis
        environment:
            POSTGRES_USER: facilmap
            POSTGRES_PASSWORD: password
            POSTGRES_DB: facilmap
        healthcheck:
            test: pg_isready -d $$POSTGRES_DB
        restart: always
```

To start FacilMap, run `docker-compose up -d` in the directory of the `docker-compose.yml` file. To upgrade FacilMap, run `docker-compose pull` and then restart it by running `docker-compose up -d`.

Note that this exposes FacilMap through unencrypted HTTP on port 8080. In a production setup, FacilMap should be served by a reverse proxy that provides HTTPS. Usually, the `ports` directive can be removed then.
```

## 10. docs.facilmap.org_developers_server_standalone.html.md

```md
---
url: "https://docs.facilmap.org/developers/server/standalone.html"
title: "Standalone | FacilMap"
---

# [\#](https://docs.facilmap.org/developers/server/standalone.html\#standalone) Standalone

The FacilMap server runs on [Node.jsopen in new window](https://nodejs.org/en/). To run the FacilMap server, the following dependencies are needed:

- You need to have a recent version of Node.js and npm installed.
- You need to create a database on one of the systems supported by [Sequelizeopen in new window](https://sequelize.org/master/), it is recommended to use MySQL/MariaDB.
  - When creating a MySQL/MariaDB database for FacilMap, make sure to use the `utf8mb4` charset/collation to make sure that characters from all languages can be used on a map. By default, MySQL/MariaDB uses the `latin1` charset, which mostly supports only basic latin characters. When you start the FacilMap server for the first time, the necessary tables are created using the charset of the database.
  - When using PostgreSQL, the PostGIS extensions must be enabled.
- It is recommended to run FacilMap as an unprivileged user.

## [\#](https://docs.facilmap.org/developers/server/standalone.html\#run-the-latest-release) Run the latest release

A bundled version of the FacilMap server is published on NPM as [facilmap-serveropen in new window](https://www.npmjs.com/package/facilmap-server). To run it, run the following steps:

1. If you don’t have a global NPM prefix set up yet, run `npm config set prefix ~/.local`. This will install npm packages into `~/.local/bin`, rather than trying to install them into `/usr/local/bin`.
2. Install facilmap-server by running `npm install -g facilmap-server`
3. Create a `config.env` file based on [`config.env.example`open in new window](https://github.com/FacilMap/facilmap/blob/main/config.env.example) and to adjust the [configuration](https://docs.facilmap.org/developers/server/config.html).
4. Start the FacilMap server by running `~/.local/bin/facilmap-server dotenv_config_path=config.env`.

FacilMap will need write access to the directory `~/.local/lib/node_modules/.cache/facilmap-server` (or specify another directory in the `CACHE_DIR` environment variable). All other files and directories can be read-only. To harden the FacilMap installation, make the whole installation folder owned by root, but create the cache directory and make it owned by the facilmap user.

## [\#](https://docs.facilmap.org/developers/server/standalone.html\#run-the-development-version) Run the development version

To run the latest state from the [FacilMap repositoryopen in new window](https://github.com/FacilMap/facilmap), run the following steps:

1. Make sure that you have a recent version of [Node.jsopen in new window](https://nodejs.org/), [yarnopen in new window](https://yarnpkg.com/) and a database (MariaDB, MySQL, PostgreSQL, SQLite, Microsoft SQL Server) set up. (Note that only MySQL/MariaDB has been tested so far.)
2. Clone the [FacilMap repositoryopen in new window](https://github.com/FacilMap/facilmap).
3. Run `yarn install` in the root folder of this repository to install the dependencies.
4. Run `yarn build` to create the JS bundles.
5. Copy `config.env.example` to `config.env` and adjust the [configuration](https://docs.facilmap.org/developers/server/config.html).
6. Inside the `server` directory, run `yarn server`. This will automatically set up the database structure and start the server.

You can also run `yarn dev-server`, which will automatically rebuild the frontend bundle when the code is changed. See [dev setup](https://docs.facilmap.org/developers/development/dev-setup.html) for more information.
```
