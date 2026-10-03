export interface ScribeAnswer {
  link_id: string;
  values: string[];
}

export interface ScribeMedication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface ScribeResult {
  transcript: string;
  answers: ScribeAnswer[];
  symptoms: string[];
  diagnoses: string[];
  medications: ScribeMedication[];
  investigations: string[];
}

/** A form question as sent to the scribe (only types it can fill). */
export interface ScribeQuestion {
  link_id: string;
  text: string;
  type: string;
  multiple: boolean;
  options: string[];
}
