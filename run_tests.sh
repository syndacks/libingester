#!/bin/bash -e

CURRENT_DIR=$(dirname $(readlink -f $0))

JENKINS_OUTPUT="false"
if [ $# -gt 0 ] && [ "$1" == "--jenkins" ]; then
  echo "Jenkins reporter activated"
  JENKINS_OUTPUT="true"
fi

pushd $CURRENT_DIR > /dev/null
  if [ "$JENKINS_OUTPUT" == "true" ]; then
    rm -f reports/*.xml

    export JUNIT_REPORT_NAME="Libingester Tests"
    export JUNIT_REPORT_PATH=reports/report.xml
    export JUNIT_REPORT_STACK=1
    export JUNIT_REPORT_PACKAGES=1

    ./node_modules/.bin/mocha --harmony_default_parameters \
                              --recursive \
                              --check-leaks \
                              --reporter mocha-jenkins-reporter || true
  else
    ./node_modules/.bin/mocha --harmony_default_parameters --recursive --check-leaks
  fi
popd >/dev/null
