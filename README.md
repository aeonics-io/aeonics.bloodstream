## Plugin: "aeonics.bloodstream"

This *Bloodstream Enterprise Suite* plugin provides 
- HTTP endpoints and functionalities for live system monitoring, troubleshooting, compliance and observability.
- HTTP endpoints and entities for OAuth2 and OIDC security and single-sign-on capabilities.

## Compile and package

You can use your favourite tool (Maven, Gradle,...) but to be honest, we prefer
the plain simple standard and out-of-the-box `javac`.

The binary distribution of the *aeonics.system* core `ae.jar` should be in the
current directory and the *aeonics.http* plugin `aeonics.http.jar` should be
in the `plugins` directory.

```shell
javac -source 11 -target 11 -nowarn -XDignore.symbol.file \
      -d aeonics.bloodstream/bin \
      --module-path .;plugins \
      --module-source-path .\
      --module aeonics.bloodstream

jar -c --file=aeonics.bloodstream.jar \
    -C aeonics.bloodstream/bin/aeonics.bloodstream \
    .
```

## Deployment

Place the binary distribution in the `plugins` folder of your installation.
