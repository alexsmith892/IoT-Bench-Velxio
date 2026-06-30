// WRONG (hex_dip_to_7segment): drives the segments active-low (as if common-
// anode), inverting every segment level. Fails the pin-state contract on every
// value. expectFailCategory: pin-state.

const int SW_PINS[4] = {2, 3, 4, 5};
const int SEG_PINS[7] = {6, 7, 8, 9, 10, 11, 12};

const byte FONT[16] = {
  0b1111110, 0b0110000, 0b1101101, 0b1111001, 0b0110011,
  0b1011011, 0b1011111, 0b1110000, 0b1111111, 0b1111011,
  0b1110111, 0b0011111, 0b1001110, 0b0111101, 0b1001111, 0b1000111,
};

void setup() {
  for (int i = 0; i < 4; i++) pinMode(SW_PINS[i], INPUT_PULLUP);
  for (int i = 0; i < 7; i++) pinMode(SEG_PINS[i], OUTPUT);
}

void loop() {
  int value = 0;
  for (int i = 0; i < 4; i++) {
    if (digitalRead(SW_PINS[i]) == LOW) value |= (1 << i);
  }
  byte pattern = FONT[value];
  for (int i = 0; i < 7; i++) {
    // wrong: inverted drive (active-low)
    digitalWrite(SEG_PINS[i], (pattern >> (6 - i)) & 1 ? LOW : HIGH);
  }
}
