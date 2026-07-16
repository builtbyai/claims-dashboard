#!/usr/bin/env python3
"""
Migrate existing customer data from database/customers.db to master.db
"""

import sqlite3
import os
from datetime import datetime

def migrate_data():
    # Connect to source database
    source_db = 'database/customers.db'
    target_db = 'database/master.db'

    source_conn = sqlite3.connect(source_db)
    target_conn = sqlite3.connect(target_db)

    source_cursor = source_conn.cursor()
    target_cursor = target_conn.cursor()

    # Get all customers from source
    source_cursor.execute('''
        SELECT
            id, name, normalized_name, property_address, city, state, zip,
            claim_number, insurance_company, adjuster_name,
            contact_phone, contact_email, status, folder_path,
            photo_count, supplement_count, created_at, updated_at,
            adjuster_phone, adjuster_email, needs_supplement, supplement_reason,
            estimate_owes, estimate_total
        FROM customers
    ''')

    customers = source_cursor.fetchall()
    print(f"Found {len(customers)} customers to migrate")

    migrated = 0
    for customer in customers:
        try:
            # Map old fields to new schema
            target_cursor.execute('''
                INSERT INTO customers (
                    name, normalized_name, property_address, city, state, zip,
                    phone, email,
                    claim_number, claim_status,
                    policy_company, adjuster_name, adjuster_phone, adjuster_email,
                    photo_count, supplement_reason,
                    rcv_amount, outstanding_balance,
                    kanban_stage,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                customer[1],  # name
                customer[2],  # normalized_name
                customer[3],  # property_address
                customer[4],  # city
                customer[5],  # state
                customer[6],  # zip
                customer[10], # contact_phone -> phone
                customer[11], # contact_email -> email
                customer[7],  # claim_number
                customer[12], # status -> claim_status
                customer[8],  # insurance_company -> policy_company
                customer[9],  # adjuster_name
                customer[18], # adjuster_phone
                customer[19], # adjuster_email
                customer[14], # photo_count
                customer[21], # supplement_reason
                customer[23] or 0,  # estimate_total -> rcv_amount
                customer[22] or 0,  # estimate_owes -> outstanding_balance
                'needs_supplement' if customer[20] else 'submitted',  # kanban_stage
                customer[16], # created_at
                customer[17]  # updated_at
            ))
            migrated += 1
        except sqlite3.IntegrityError as e:
            print(f"Error migrating customer {customer[1]}: {e}")
            continue

    # Commit changes
    target_conn.commit()

    # Log migration
    target_cursor.execute('''
        INSERT INTO sync_log (
            sync_type, sync_status, records_processed, records_created,
            start_time, end_time, details, triggered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'migration',
        'completed',
        len(customers),
        migrated,
        datetime.now().isoformat(),
        datetime.now().isoformat(),
        f'{{"source": "database/customers.db", "migrated": {migrated}}}',
        'manual'
    ))

    target_conn.commit()

    # Close connections
    source_conn.close()
    target_conn.close()

    print(f"\n✓ Migration completed successfully!")
    print(f"  - Total records processed: {len(customers)}")
    print(f"  - Records migrated: {migrated}")
    print(f"  - Target database: {target_db}")

    return migrated

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
    migrate_data()
