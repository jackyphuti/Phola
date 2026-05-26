export type CrimeType =
  | 'gbv'
  | 'assault'
  | 'robbery'
  | 'vehicle_theft'
  | 'housebreaking'
  | 'drug_activity'
  | 'suspicious_behaviour'
  | 'police_misconduct'
  | 'corruption'

export const CRIME_TYPE_LABELS: Record<CrimeType, string> = {
  gbv: 'GBV',
  assault: 'Assault',
  robbery: 'Robbery',
  vehicle_theft: 'Vehicle theft',
  housebreaking: 'Housebreaking',
  drug_activity: 'Drug activity',
  suspicious_behaviour: 'Suspicious behaviour',
  police_misconduct: 'Police misconduct',
  corruption: 'Corruption',
}

export type DynamicFieldConfig = {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'textarea'
  required?: boolean
}

export const DYNAMIC_FIELDS_BY_TYPE: Partial<Record<CrimeType, DynamicFieldConfig[]>> = {
  gbv: [
    { key: 'relationship_to_suspect', label: 'Relationship to person involved', placeholder: 'Partner, ex-partner, family, colleague...', type: 'text' },
    { key: 'immediate_safety_risk', label: 'Immediate safety risk details', placeholder: 'Is there immediate danger right now?', type: 'textarea' },
  ],
  assault: [
    { key: 'number_of_suspects', label: 'Number of suspects', placeholder: '1, 2, 3...', type: 'text' },
    { key: 'injury_summary', label: 'Injury summary', placeholder: 'Any injuries and urgent medical needs', type: 'textarea' },
  ],
  robbery: [
    { key: 'items_taken', label: 'Items taken', placeholder: 'Phone, wallet, cash...', type: 'textarea' },
    { key: 'weapon_seen', label: 'Weapon seen', placeholder: 'Knife, firearm, none, unknown', type: 'text' },
  ],
  vehicle_theft: [
    { key: 'vehicle_make_model', label: 'Vehicle make and model', placeholder: 'Toyota Corolla', type: 'text', required: true },
    { key: 'vehicle_registration', label: 'Registration number', placeholder: 'ABC123GP', type: 'text' },
    { key: 'last_seen_location', label: 'Last seen location', placeholder: 'Street, suburb, landmark', type: 'text' },
  ],
  housebreaking: [
    { key: 'property_type', label: 'Property type', placeholder: 'House, flat, shop', type: 'text' },
    { key: 'entry_point', label: 'Suspected entry point', placeholder: 'Window, door, gate...', type: 'text' },
  ],
  drug_activity: [
    { key: 'suspected_substance', label: 'Suspected substance', placeholder: 'Unknown, tik, nyaope...', type: 'text' },
    { key: 'activity_pattern', label: 'Observed activity pattern', placeholder: 'Times, frequency, number of people', type: 'textarea' },
  ],
  suspicious_behaviour: [
    { key: 'suspect_description', label: 'Suspect description', placeholder: 'Clothing, age range, distinguishing features', type: 'textarea' },
    { key: 'vehicle_description', label: 'Vehicle description (if any)', placeholder: 'Color, model, partial plate', type: 'text' },
  ],
  police_misconduct: [
    { key: 'officer_details', label: 'Officer details', placeholder: 'Name, badge number, station (if known)', type: 'textarea', required: true },
    { key: 'misconduct_type', label: 'Type of misconduct', placeholder: 'Assault, extortion, negligence...', type: 'text' },
  ],
  corruption: [
    { key: 'corruption_type', label: 'Corruption type', placeholder: 'Bribery, fraud, tender abuse...', type: 'text', required: true },
    { key: 'parties_involved', label: 'Parties involved', placeholder: 'Names/roles if known', type: 'textarea' },
  ],
}
