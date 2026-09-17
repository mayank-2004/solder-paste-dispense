# Custom Firmware Documentation

This document explains the setup, wiring, and configuration for the 4 custom Arduino boards used in the Solder Paste Dispenser project. These boards are used specifically for advanced sensor feedback, while standard motion (steppers/servos) is handled by unmodified GRBL boards.

---

## 1. Payload Manager Board (`PayloadManager.ino`)
Reads the physical weight of the multi-function head to ensure it does not exceed the 2.0 kg mechanical limit.

* **Required Library:** `HX711 Arduino Library` by Bogdan Necula
* **Installation Path:** Open Arduino IDE ➔ **Sketch** menu ➔ **Include Library** ➔ **Manage Libraries** ➔ Search for "HX711" and click Install.
* **Pin Configuration:**
  * **Pin 3:** HX711 `DOUT` (Data)
  * **Pin 2:** HX711 `SCK` (Clock)
  * **5V / GND:** HX711 Power
* **Parameters to Change:**
  * `calibration_factor = -7050.0;` ➔ You **must** change this value. To find your value, place a known weight (e.g., 100g) on your specific load cell and adjust this number until `scale.get_units()` outputs exactly `0.10` (kg).

---

## 2. Flux Manager Board (`FluxManager.ino`)
Monitors the live gross weight of the flux syringe and continuously broadcasts it to the React app to calculate remaining volume.

* **Required Library:** `HX711 Arduino Library` by Bogdan Necula
* **Installation Path:** Open Arduino IDE ➔ **Sketch** menu ➔ **Include Library** ➔ **Manage Libraries** ➔ Search for "HX711" and click Install.
* **Pin Configuration:**
  * **Pin 3:** HX711 `DOUT` (Data)
  * **Pin 2:** HX711 `SCK` (Clock)
  * **5V / GND:** HX711 Power
* **Parameters to Change:**
  * `calibration_factor = -7050.0;` ➔ Like the payload manager, adjust this using a known calibration weight so the output perfectly matches the syringe weight in grams/kilograms.

---

## 3. Safety Manager Board (`SafetyManager.ino`)
Monitors the critical physical safety sensors (E-Stop, Door, Light Curtain) and instantly broadcasts `[FAULT:Exxx]` codes to halt the React software.

* **Required Library:** None (Uses standard Arduino core functions).
* **Pin Configuration:** *(Note: All pins use `INPUT_PULLUP`. Wire the physical switches so that they connect the Pin to **GND** when triggered/pressed).*
  * **Pin 2:** Emergency Stop Button
  * **Pin 3:** Optical Light Curtain
  * **Pin 4:** Enclosure Door Limit Switch
  * **Pin 5:** Solder Wire Spool Low Sensor
* **Parameters to Change:**
  * `if (millis() - lastBroadcast > 500)` ➔ You can change `500` to make the fault broadcast faster or slower. `500` means it blasts the fault to the software every half-second while the button is pressed, ensuring the user cannot accidentally bypass it.

---

## 4. Fume Extraction Board (`FumeExtraction.ino`)
Acts like a standard GRBL board (receiving `M3/M5` commands) to control a PWM fan, while using an interrupt pin to measure the tachometer RPM and detect jammed filters.

* **Required Library:** None (Uses standard Arduino interrupts and PWM).
* **Pin Configuration:**
  * **Pin 9:** Fan PWM Control (Connect to the fan's PWM wire or a MOSFET gate).
  * **Pin 2:** Fan Tachometer (Connect to the fan's RPM sense wire. **Must** remain on Pin 2 or Pin 3 because it requires Hardware Interrupts).
* **Parameters to Change:**
  * `if (currentPwm > 50 && rpm < 200)` ➔ **Jam Threshold**. Change `200` to the minimum RPM your specific fan should spin at when given power. If it drops below this number, the board triggers an `E002` fire/jam safety fault.
  * `rpm = (pulses / 2) * 60;` ➔ Standard PC fans send **2** pulses per revolution. If you use an industrial fan that sends 1 or 4 pulses per rev, change the `2` in this equation to match your fan's datasheet.

