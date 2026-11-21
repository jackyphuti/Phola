#!/usr/bin/env python3
"""
Phola Safety Engine CLI
Unified command-line orchestrator for all Python safety, security, and asset pipelines.

Usage:
    python3 scripts/phola_cli.py <command>

Commands:
    assets        Generate iOS, Android, and Web PWA icons and splash screens
    verify-data   Audit SAPS police stations and danger zone datasets
    audit         Run security, secret leak, and SOS load benchmark
    danger-zones  Run spatial danger zone clustering and coordinate risk check
    docket        Generate a formal SAPS Section 212 sworn docket affidavit
    watchdog      Simulate Safe Ride Watchdog route deviation detection
    all           Run the full suite of verification and asset generation
"""

import argparse
import sys
import subprocess
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent


def run_script(script_name: str) -> bool:
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        print(f"❌ Script not found: {script_path}")
        return False

    res = subprocess.run([sys.executable, str(script_path)])
    return res.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="Phola Safety Engine & Asset Automation CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "command",
        choices=["assets", "verify-data", "audit", "danger-zones", "docket", "watchdog", "all"],
        help="Command to execute",
    )

    args = parser.parse_args()

    command_map = {
        "assets": "generate_assets.py",
        "verify-data": "verify_safety_data.py",
        "audit": "security_audit.py",
        "danger-zones": "danger_zone_analyzer.py",
        "docket": "evidence_transcriber.py",
        "watchdog": "safe_ride_watchdog.py",
    }

    if args.command == "all":
        print("🚀 Running full Phola verification, asset generation, and safety audit...\n")
        all_passed = True
        for name, script in command_map.items():
            print(f"\n--- Running: {name} ({script}) ---")
            if not run_script(script):
                all_passed = False
        if all_passed:
            print("\n🎉 ALL PHOLA PYTHON PIPELINES COMPLETED SUCCESSFULLY!")
            sys.exit(0)
        else:
            print("\n⚠️ One or more pipelines encountered errors.")
            sys.exit(1)
    else:
        script = command_map[args.command]
        success = run_script(script)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
