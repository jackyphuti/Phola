#!/usr/bin/env python3
"""
Phola Evidence Transcriber & SAPS Police Docket Formatter
Generates sworn affidavit police statements compliant with South African Police Service (SAPS)
Criminal Procedure Act requirements from incident notes, voice transcripts, and vault evidence.
"""

import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


def format_saps_statement(
    complainant_name: str,
    id_or_ref_number: str,
    contact_phone: str,
    home_address: str,
    incident_date: str,
    incident_location: str,
    incident_type: str,
    narrative: str,
    suspect_details: Optional[Dict[str, str]] = None,
    evidence_items: Optional[List[str]] = None,
    nearest_station: str = "Pretoria Central SAPS",
) -> str:
    """
    Formats incident metadata into a legally structured South African Police Service (SAPS)
    sworn affidavit statement.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    evidence_section = ""
    if evidence_items:
        evidence_section = "\n6. EXHIBITS & DIGITAL EVIDENCE SUBMITTED:\n"
        for idx, item in enumerate(evidence_items, 1):
            evidence_section += f"   Exhibit {chr(64 + idx)}: {item}\n"
    else:
        evidence_section = "\n6. EXHIBITS: No digital exhibits attached.\n"

    suspect_section = "Unknown at time of reporting."
    if suspect_details:
        suspect_section = f"\n   - Known Name/Alias: {suspect_details.get('name', 'Unknown')}\n"
        suspect_section += f"   - Relationship to Complainant: {suspect_details.get('relationship', 'None / Acquaintance')}\n"
        suspect_section += f"   - Physical Description / Notes: {suspect_details.get('notes', 'Not provided')}\n"

    template = f"""================================================================================
                     SOUTH AFRICAN POLICE SERVICE (SAPS)
                      SWORN COMPLAINANT STATEMENT / AFFIDAVIT
                    (In terms of Section 212 of Act 51 of 1977)
================================================================================

STATION: {nearest_station}
DOCKET / CAS REF NO: {id_or_ref_number}
DATE RECORDED: {now}

1. COMPLAINANT PARTICULARS:
   Full Name: {complainant_name}
   Identity / Passport / Vault Reference: {id_or_ref_number}
   Contact Number: {contact_phone}
   Residential / Safe Address: {home_address}

2. INCIDENT PARTICULARS:
   Offence / Crime Classification: {incident_type.upper()}
   Date & Time Occurred: {incident_date}
   Location / GPS Coordinates: {incident_location}

3. PERPETRATOR / SUSPECT INFORMATION:
   {suspect_section}

4. STATEMENT UNDER OATH (CHRONOLOGICAL NARRATIVE):
   I, the undersigned, hereby make oath and state under penalty of perjury that:

{narrative.strip()}

5. HARM & TRAUMA DETAILS:
   The complainant reported threat to personal safety, severe trauma, or property/bodily harm.
   Immediate referral to Victim-Friendly Facility (VFR) recommended.
{evidence_section}
================================================================================
                            DECLARATION UNDER OATH
================================================================================
I declare that I know and understand the contents of this declaration, that it is 
to the best of my knowledge and belief true and correct, and that I have no 
objection to taking the prescribed oath.

___________________________                      ___________________________
Complainant Signature / Fingerprint              Date & Time

CERTIFICATE OF COMMISSIONER OF OATHS:
I certify that the deponent has acknowledged that they know and understand the 
contents of this declaration which was sworn to / affirmed before me at:

Place: _____________________    Date: ______________    Time: ______________

____________________________________
Commissioner of Oaths Ex Officio
Rank & Force Number: _______________
SAPS Stamp:
================================================================================
"""
    return template


def generate_sample_docket() -> Path:
    """Generates a demo SAPS police docket statement."""
    narrative = (
        "On Friday, 21 November 2026 at approximately 22:30, I was traveling along Burnett Street "
        "near the Hatfield Gautrain Station in Pretoria. A male suspect approached me aggressively, "
        "threatened me, and demanded my personal belongings. When I resisted, he brandished a weapon "
        "and pushed me to the ground. I managed to trigger my Phola Emergency SOS alert which broadcasted "
        "my live coordinates to my emergency contacts. The suspect fled toward Grosvenor Street when "
        "bystanders approached."
    )

    statement = format_saps_statement(
        complainant_name="Confidential Complainant (Phola Vault Protected)",
        id_or_ref_number="VAULT-782914",
        contact_phone="+27 82 *** 4910",
        home_address="Hatfield Safe Zone, Tshwane, Gauteng",
        incident_date="2026-11-21 22:30 SAST",
        incident_location="-25.7505, 28.2385 (Burnett & Grosvenor St, Hatfield)",
        incident_type="Robbery with Aggravating Circumstances / GBV Threat",
        narrative=narrative,
        suspect_details={
            "name": "Unidentified male suspect",
            "relationship": "Stranger",
            "notes": "Tall build, dark jacket, cap. Fled eastbound on foot.",
        },
        evidence_items=[
            "GPS Breadcrumb Trail (Phola Background Watcher, 5m accuracy)",
            "30-second Emergency Audio Ambient Recording (Captured via Phola Vault)",
            "Automated Distress Dispatch Log with Timestamps (Guardian Circle pinged)",
        ],
        nearest_station="Brooklyn Police Station (SAPS)",
    )

    out_file = Path("/tmp/SAPS_Docket_VAULT-782914.txt")
    out_file.write_text(statement, encoding="utf-8")
    return out_file


if __name__ == "__main__":
    out_path = generate_sample_docket()
    print(f"✅ Generated SAPS Sworn Docket Statement:\n")
    print(out_path.read_text()[:600] + "\n...[Full Statement Generated in " + str(out_path) + "]")
