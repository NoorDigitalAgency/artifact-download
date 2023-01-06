# Artifact Download with Backblaze as the backend

Replacement for the `actions/download-artifact` that is extrimly slow.

This alternative uses Backblaze as the backup storage and a TAR bundle for the artifacts and can be between 2 to 100 times faster than the `actions/download-artifact` depending on the number and size of the artifact files.

```yaml
      - uses: noordigitalagency/artifact-download@main
        with:
          name: artifact
          path: ./
          key: ${{ secrets.BACKBLAZE_KEY }}
          id: ${{ secrets.BACKBLAZE_ID }}
          bucket: ${{ secrets.BACKBLAZE_BUCKET }}
```
