# Confab Reserve

**A Cordova-based mobile application prototype for reserving Annex
Library confab rooms.**

Confab Reserve allows students to browse room availability and manage
their reservations. Library staff can use the administrator interface to
review reservations and manage rooms, booking rules, and blocked time
slots.

## Project Overview

This project is a front-end mobile application prototype developed with
HTML, CSS, and JavaScript and packaged for Android using Apache Cordova.

The interface follows the screen designs prepared for Milestone 1. The
updated version contains **16 screens** and opens directly at the Login
screen; the previous splash screen has been removed.

## Main Features

### Student

-   Log in using the student demo account or register a student account.
-   Browse available confab rooms.
-   View room availability by date and time slot.
-   Submit a reservation with attendee and purpose details.
-   View reservation confirmation and reservation history.
-   View notifications.
-   View profile information and account role.

### Administrator / Library Staff

-   Log in using the administrator demo account.
-   Open the administrator reservation dashboard.
-   View and review reservations.
-   View reservation details and manage reservation records.
-   Manage confab room information.
-   Configure booking rules.
-   Create and manage blocked room time slots.

## Demo Accounts

Use these accounts to test the prototype:

  Role                    Email                   Password
  ----------------------- ----------------------- --------------
  Student                 `student@confab.test`   `student123`
  Administrator / Staff   `admin@confab.test`     `admin123`

The administrator account should open the administrator reservation
dashboard and display the administrator role. The student account opens
the student experience.

**Demo-only authentication:** These credentials and role checks are
implemented in the front-end JavaScript. This prototype is not connected
to a production authentication service or database. Do not use real
passwords or sensitive personal information.

## Project Structure

The main application source files are:

``` text
ConfabReserve/
├── config.xml
├── package.json
├── www/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── platforms/
    └── android/
```

-   `www/index.html` --- application markup and screen structure.
-   `www/style.css` --- visual styling and responsive layout.
-   `www/script.js` --- screen navigation, demo login and role handling,
    sample data, reservations, and administrator interactions.
-   `config.xml` and `package.json` --- Cordova project configuration
    and dependencies.
-   `platforms/android/` --- generated Android platform project.

**Edit the files in `www/`.** Do not edit generated copies inside
`platforms/android/`, because Cordova can overwrite them during
preparation or build.

## Requirements

Install the following before building the Android app:

-   Node.js and npm
-   Apache Cordova CLI
-   Java Development Kit (JDK), compatible with the installed Android
    Gradle Plugin
-   Android Studio
-   Android SDK and the required Android build tools
-   An Android emulator or a physical Android device with USB debugging
    enabled

Cordova and Android tooling versions can affect build requirements. Use
the versions configured for this project and install any SDK components
requested by Android Studio.

## Run the App in a Browser

For a quick interface preview, open `www/index.html` in a modern
browser.

Some Cordova-specific functionality may behave differently outside the
Android application.

## Build and Run on Android

1.  Open a terminal in the project root folder (the folder containing
    `config.xml`).

2.  Prepare the Android platform:

    ``` bash
    cordova prepare android
    ```

3.  Build the debug APK:

    ``` bash
    cordova build android
    ```

4.  Open the generated Android project in Android Studio:

    ``` text
    platforms/android
    ```

5.  Select an Android emulator or connected device, then click **Run**.

