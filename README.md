# leaflet-offline
A Leaflet library that downloads map tiles and uses them offline.

## Inspiration
This library was heavily inspired and based on the [leaflet.offline](https://github.com/allartk/leaflet.offline) library by Allart Kooiman.
I decided to create a new one because the ideas I had were diverging too much from what ```leaflet.offline``` proposes to do.

The biggest change I made was removing the dependency on [localForage](https://github.com/localForage/localForage) and introducing a new option parameter that makes you able to give your own implementantion of a database to save the tiles however you like as long as it implements the same interface (more on that below). This way you can decide where to save your tiles (client or server) and how to do it.