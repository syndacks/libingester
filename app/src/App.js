
import CodeMirror from 'codemirror';
import debounce from 'debounce';
import React, { Component } from 'react';
import Request from 'superagent';
import { Col, Nav, NavItem } from 'react-bootstrap';

import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';

class CodeEditor extends Component {
    onChange(doc, change) {
        if (this.props.onChange)
            this.props.onChange(doc.getValue());
    }
    componentDidMount() {
        this.cm = CodeMirror.fromTextArea(this.textArea, { mode: 'javascript' });
        this.cm.setValue(this.props.defaultValue);
        this.cm.on('change', (doc) => this.onChange(doc));
    }
    componentWillUnmount() {
        // unbind all the CodeMirror junk
        this.cm.toTextArea();
    }
    render() {
        return <div><textarea ref={(node) => this.textArea = node} /></div>;
    }
}

class InputPane extends Component {
    onUrlChanged = (event) => {
        this.url = event.target.value;
        this.props.onChange({ url: this.url, code: this.code });
    }

    onCodeChanged = (newValue) => {
        this.code = newValue;
        this.props.onChange({ url: this.url, code: this.code });
    }

    render() {
        const defaultCode = `
const moshpit = require('moshpit');
const cheerio = require('cheerio');

function main(input) {
    const $ = cheerio.load(input);
    const metadata = {};

    // ...

    return new moshpit.Asset(new moshpit.ArticleContentModel(metadata), $.html());
}
`;

        return (
            <div>
            <input type="url" name="url" onChange={this.onUrlChanged} />
            <CodeEditor defaultValue={defaultCode} onChange={this.onCodeChanged} />
            </div>
        );
    }
}

class OutputPane extends Component {
    constructor(props) {
        super(props);

        this.state = { activeTab: 1 };
    }

    renderHTMLPreview() {
        return (<div />);
    }

    renderHTMLCode() {
        return (<div />);
    }

    renderMetadata() {
        return (<div />);
    }

    renderContent(tab) {
        if (tab === 1) return this.renderHTMLPreview();
        if (tab === 2) return this.renderHTMLCode();
        if (tab === 3) return this.renderMetadata();
    }

    onTabSelect(activeTab) {
        this.setState({ activeTab: activeTab });
    }

    render() {
        const content = this.renderContent(this.state.activeTab);

        return (<div>
            <Nav bsStyle="tabs" activeKey={this.state.activeTab}>
            <NavItem eventKey={1} href="#" onSelect={(activeTab) => this.onTabSelect(activeTab)}>HTML Preview</NavItem>
            <NavItem eventKey={2} href="#" onSelect={(activeTab) => this.onTabSelect(activeTab)}>HTML Source</NavItem>
            <NavItem eventKey={3} href="#" onSelect={(activeTab) => this.onTabSelect(activeTab)}>Metadata</NavItem>
            </Nav>
            {content}
        </div>);
    }
}

function fetchURL(url) {
    const PROXY_URL = "http://localhost:10023/";
    return Request.get(PROXY_URL).query({ target: url });
}

function evaluateCode(code, input) {
    const body = ```"use strict";
const module = {};

function require(name) { return SystemJS.import(name); }

${code};

return module.exports(input);
    ```;
    const func = new Function(['input'], body);
    return func(input);
}

class App extends Component {
    constructor(props) {
        super(props);

        this.onInputChange = debounce(this._onInputChange, 500);
        this.state = {};
    }

    _onInputChange = (newState) => {
        let urlChanged = false;

        if (this.state.url !== newState.url) {
            this.setState({ url: newState.url });
            urlChanged = true;
            this.processURL();
        }

        if (this.state.code !== newState.code) {
            this.setState({ code: newState.code });
            if (!urlChanged)
                this.processCode();
        }
    }

    processURL() {
        this.pageContents = null;
        return fetchURL(this.state.url).then((result) => {
            this.pageContents = result;
            console.log(this.pageContents);
        }).then(() => this.processCode);
    }

    processCode() {
        const result = evaluateCode(this.state.code);
        console.log(result);
    }

    render() {
        return (<div>
            <Col md={4}><InputPane onChange={this.onInputChange} /></Col>
            <Col md={8}><OutputPane /></Col>
        </div>);
    }
}

export default App;
