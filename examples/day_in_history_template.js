'use strict';

const structure_template = (`
<section class="title">
  <h1 id="title">{{ title }}</h1>
  <p id="date">{{ date }}</p>
</section>

<br/>

<section class="mainContent">

  <h3>On this Day in History</h3>
    <p id="dayInHistoryHeadFinal">{{ dayInHistoryHeadFinal }}</p>
    <p id="dayInHistoryBodyFinal">{{ dayInHistoryBodyFinal }}</p>
    <p id="dayInHistoryYearFinal">{{ dayInHistoryYearFinal }}</p>

    <br/>
</section>`);

exports.structure_template = structure_template;
