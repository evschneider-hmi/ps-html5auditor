# Google H5 Validator Checks (from live testing)

## Checks Performed by Google H5 Validator:

1.  **4th party calls check** - Checks that all assets are relative to creative. Exceptions may be granted for specific URLs depending on policy.

2.  **File Type/Count** - Ensures all files contained in the zip bundle are supported.

3.  **GWD environment check** - Ensures creatives built in Google Web Designer were created using the correct environment.

4.  **HTML5 Not Allowed Features check** - Checks for unsupported HTML5 features.

5.  **Hard coded click tag check** - Ensures no hard coded click tags are present.

6.  **Invalid click tag check** - Ensures any click tags present are valid.

7.  **Missing asset check** - Ensures that all referenced assets are present in the bundle.

8.  **Missing click tag check** - Ensures that required click tags are present.

9.  **Orphaned asset check** - Ensures no extraneous files are included in the bundle.

10.  **Primary Creative Asset** - Ensures that the creative bundle includes a primary asset.

11.  **Secure URL check** - Checks that all non-relative assets are loaded over HTTPS.

12.  **Top level click tag check** - Ensures a click tag is present in the top-level html file.

## Test Creative: Honda HRV 320x50
- File: HRV_NEW_National Mobile_NSEV_NOIN_ENG_320x50_WDCH_H5_NV_NCTA_HRV.zip
- Size: 47.3Kb
- Result:  ALL CHECKS PASSED

## Next: Test with creative containing .db file to confirm it fails
