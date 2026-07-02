# Security Specification: Fuel Management Portal (มทบ.44)

## 1. Data Invariants
- **Fuel Inventory**: Accessible by any signed-in user for reading (drivers need to check stock levels, and officers manage stock). Modified only by officers during replenishment or during transactions.
- **Fuel Records**: Read/write access by authenticated officers. Standard users (drivers) cannot write records directly.
- **Fuel Requests**: Drivers can create, read, and delete/update their own pending requests. Officers can read all requests, and can update statuses (approved/rejected).
- **Users**: Signed-in users can write and read their own user profiles. Nobody can write to other profiles.

## 2. The "Dirty Dozen" Payloads
1. Spoofed inventory stock update by standard user (Driver).
2. Direct deletion of a fuel record by a driver.
3. Modification of an approved request by a driver (Terminal State Lock).
4. Forging of another driver's request.
5. Injected extremely large string as standard IDs.
6. Spoofing of email without verification.
7. Blank reads on users collection.
8. Unauthorized role self-escalation during user creation.
9. Writing system-generated timestamp fields using client values.
10. Decrementing stock levels to negative value.
11. Bypassing state machine transitions on requests.
12. Relational mismatch of records (e.g. invalid fuel type).

## 3. Test Cases (TDD Blueprint)
Every access pattern must strictly enforce permissions:
- `allow read: if isSignedIn();` on inventory.
- `allow write: if isSignedIn() && isOfficer();` on inventory and records.
- `allow create: if isSignedIn() && isOwner(incoming().requestedBy);` on requests.
