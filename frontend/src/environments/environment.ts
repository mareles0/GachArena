// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  backendUrl: 'http://localhost:3000/api',
  firebaseConfig: {
    apiKey: "AIzaSyBblx0dqYPJ7zJ8IaXDYFfCvYHRmBa2kdk",
    authDomain: "gacharena-bd17c.firebaseapp.com",
    projectId: "gacharena-bd17c",
    storageBucket: "gacharena-bd17c.firebasestorage.app",
    messagingSenderId: "796223699652",
    appId: "1:796223699652:web:27add2ea5efce629b12791"
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
