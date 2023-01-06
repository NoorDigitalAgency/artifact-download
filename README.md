```yaml
      - uses: noordigitalagency/artifact-download@main
        with:
          name: artifact
          path: ./
          key: ${{ secrets.BACKBLAZE_KEY }}
          id: ${{ secrets.BACKBLAZE_ID }}
          bucket: ${{ secrets.BACKBLAZE_BUCKET }}
```
