# Compromised NPM Package Example

⚠️ __THIS CODE IS A SECURITY EXAMPLE. NOT FOR GENERAL USE__ ⚠️

This is an example JS app to demo how [🔴🟡🟢 AMPEL](https://github.com/carabiner-dev)
can help protect against package repository compromises using
[Google's OSS Rebuild](https://github.com/google/oss-rebuild)[^1] attestations.

[^1]: Carabiner Systems is in no way affiliated with Google Inc. This project
only uses publicly available data.

The demo uses as an example the
[September 2025 npm package compromise](https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised)
when stolen registry credentials were used to push packages to the npm registry
with malware injected after checking out the original source.

The [OSS Rebuild project](https://github.com/google/oss-rebuild) tries to reproduce
the builds of popular packages published in various language ecosystems. By
reproducing an exact copy of the pacakge, you have certainty that the published
version in the package registry was built from the unmodified public source.

## The Sample App Code

This repository contains an app built with a single dependency: [Chalk](https://www.npmjs.com/package/chalk).
This module was part of the npm registry comprimise incident, v5.6.1 (now removed)
had malware in it and v5.6.2 was pushed to fix it.

In the releases page you will find release v1.0 which contains the vulnerable package.
We will apply an ampel policy to detect the compromised package and use release v1.1
to verify the policy passes with the fixed version.

## TLDR; Verify the Demo App

Before jump into into the details, let's verify the sample project in this
repository using AMPEL. This is th easiest way to use the example policy to check
the code, but to learn how it works continue reading after this section.

> [!TIP]
> First, download the latest binary from the 
> [AMPEL releases page](https://github.com/carabiner-dev/ampel/releases).

### Run the AMPEL Verifier

Make sure you have the latest binary of AMPEL and run the following command to
verify the sample releases in this repo. Release 1.0 uses the compromised 5.6.1
of the Chalk package. Verifying this release fails as there isn't an OSS Rebuild
attestation published for that version of the module:

```bash
ampel verify sha1:9b890a2457318c91ae5ed9451a4da74a092db084 \
    --policy "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    --collector release:carabiner-dev/examples-colortask@v1.0 \
    --collector ossrebuild: 
```

In the verifier output you will see that the PolicySet returns __🔴 FAIL__ as v1.0
uses a compromised version of Chalk.

#### Understanding the Invocation

Let's go through each flag to understand what it does:

First `ampel verify sha1:9b890a2...` tells ampel to verify an artifact. In
this case we are using the commit sha1 digest as the subject artifact.

The `--policy` flag tells ampel to pull and use the OSS Rebuild policy stored
in the Carabiner examples repository. Since we are not using a commit in the
policy locator, AMPEL will pull the latest revision.

The first `--collector` flag tells ampel to configure a repository collector to
read from the v1.0 release of this repository.

Finally, the seconf `--collector` flag instructs AMPEL to configure an `ossrebuild`
repository collector in the collector agent. This knows how to read data from
Google's OSS Rebuild Attestation bucket.

#### Verify the Fixed Version

Now, let's verify v1.1 which bumps Chalk to v5.6.2 which is malware-free:

```bash
ampel verify sha1:9986a7e5b0b666e4c792f1339bfb9098c4ef8aef \
    -p "git+https://github.com/carabiner-dev/examples#oss-rebuild/policyset.ampel.json" \
    -c release:carabiner-dev/examples-colortask@v1.1 \
    -c ossrebuild: 
```

This time you'll see that AMPEL returns __🟢 PASS__ with the following message:

```
Package chalk build verified through ArtifactEquivalence
```

## Go Deeper!

If you'd like to understand the inner workings of how this example is structured,
including how AMPEL extracts data from the SBOM, fetches and verifies the
attestation sigantures and incorporates contextual data, follow up to the full
tutorial:

OSS Rebuild Deep Dive → 
