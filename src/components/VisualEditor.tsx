import { Layout, message, Modal } from "antd";
import * as d3 from "d3";
import React, { Component, SyntheticEvent } from "react";

import { ApiService } from "../services/ApiService";
import { ColorTheme, sortBy } from "../utils";
import { ProgramAddress } from '../utils/constants';
import LinkModal from "./LinkModal";
import Loading from "./Loading";
import GraphModal from "./GraphModal";
import TopTools from "./TopTools";
import { Link, Graph } from "./types";
import "./VisualEditor.scss";

const { confirm } = Modal;
const { Content } = Layout;

interface InternalState {
  loading: boolean;
  addGraphLoading: boolean;
  editGraphLoading: boolean;
  showAddLinkModal: boolean;
  showAddGraphModal: boolean;
  showGraphModal: boolean;
  showLinkModal: boolean;
  selectedGraph: any;
  selectedLink: any;
  newGraph: Graph;
  newLink: Link;
  graphs: any[];
  links: any[];
  scale: number;
  all_graphs: any[];
  have2collapse: String[];
}

class VisualEditor extends Component<any, InternalState> {
  private simulation: any = null;

  constructor(props: any) {
    super(props);

    this.state = {
      loading: true,
      selectedGraph: null,
      selectedLink: null,
      addGraphLoading: false,
      editGraphLoading: false,
      showAddLinkModal: false,
      showAddGraphModal: false,
      showGraphModal: false,
      showLinkModal: false,
      newGraph: {
        id: 0,
        name: "",
      },
      newLink: {
        id: 0,
        source: null,
        target: null,
        relative: "LINK_TO",
      },
      graphs: [],
      links: [],
      all_graphs: [],
      scale: 100,
      have2collapse:[]
    };
  }


  //removes the id if it already exists 
  //adds a new id into this.state.have2collapse
  public chkCollapseOrNot(obj:any) {
    const id: String = obj.id;
    console.log(id);
    const {have2collapse} =  this.state;
    let index:number;
    if((index = have2collapse.indexOf(id)) > -1) {
      console.log("will be removed again so that user can see the children nodes of it");
      have2collapse.splice(index, 1);
    } else {
      console.log("will be added to array so that user can't see the children nodes of it");
      have2collapse.push(id);
    }
    return obj;
  }

  public async componentDidMount() {
    const { data: graphs } = await ApiService.fetchGraphs();
    // const { data: links } = await ApiService.fetchLinks();
    this.setState({all_graphs: graphs});
    this.setState({ loading: false, graphs }, () => {
      const el = document.getElementById("Neo4jContainer");
      this.initSimulation(el!, graphs, this.formatLinks());
    });
  }

  public initSimulation(el: any, graphs: any[], links: any[]) {
    if (!el) {
      return;
    }

    const width = el.clientWidth;
    const height = el.clientHeight;

    this.simulation = d3
      .forceSimulation(graphs)
      .force(
        "link",
        d3
          .forceLink(links)
          .distance(160)
          .id((d: any) => d.id)
      )
      .force("charge", d3.forceManyBody().distanceMax(300).strength(-800))
      .force("collide", d3.forceCollide().strength(-60))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const svg = d3.select("#Neo4jContainer").append("svg").attr("width", "100%").attr("height", "100%");

    this.onZoom(svg);
    this.addArrowMarker(svg);

    const link = this.initLinks(links, svg);
    const graph = this.initGraphs(graphs, svg);

    this.simulation.on("tick", () => this.handleTick(link, graph));
    this.simulation.alpha(1).restart();
  }

  public restartSimulation(e: SyntheticEvent) {
    e.stopPropagation();
    if (!this.simulation) {
      return;
    }

    this.simulation.alpha(1).restart();
  }

  public handleTick(link: any, graph: any, img?: any) {
    if (link) {
      link.selectAll(".outline").attr("d", (d: any) => this.linkArc(d));

      link.selectAll(".overlay").attr("d", (d: any) => this.linkArc(d));
    }

    graph.attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);
  }

  //when dragging started
  public onDragStarted(d: any) {
    if (!d3.event.active) {
      this.simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  //while dragging
  public onDragged(d: any) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  public onDragEnded(d: any) {
    if (!d3.event.active) {
      this.simulation.alphaTarget(0);
    }
  }

  public onZoom(svg: any) {
    // 鼠标滚轮缩放
    svg.call(
      d3.zoom().on("zoom", () => {
        const { transform } = d3.event;
        const scale = Number((transform.k * 100).toFixed());

        if (scale <= 12.5 || scale >= 500) {
          return;
        }

        this.setState({ scale });
        d3.selectAll("#Neo4jContainer > svg > g").attr("transform", transform);
      })
    );
    svg.on("dblclick.zoom", null); // 静止双击缩放
  }

  public formatLinks() {

    const {links, all_graphs, graphs} =  this.state;
    
    all_graphs.map(graph => {
      d3.hierarchy(graph).descendants().forEach(graph => {
        if(graph.children) graph.children.forEach(child => {
            links.push({
              target: graph.data.id,
              source: child.data.id
            })
        })
        graphs.push({
          id: graph.data.id,
          denomination: graph.data.Nodedata.denomination,
          img: graph.data.img,
          short_libelle_fonction: graph.data.short_libelle_fonction,
          color: graph.data.Nodedata.color
        })
      })
    })

    if (!links || !(links && links.length > 0)) {
      return [];
    }

    links.forEach((link: any) => {
      const same = links.filter((d) => d.source === link.target && d.target === link.source);
      const sameSelf = links.filter((d) => d.source === link.source && d.target === link.target);
      const all = sameSelf.concat(same);

      all.forEach((item: any, index: number) => {
        item.sameIndex = index + 1;
        item.sameTotal = all.length;
        item.sameTotalHalf = item.sameTotal / 2;
        item.sameUneven = item.sameTotal % 2 !== 0;
        item.sameMiddleLink = item.sameUneven === true && Math.ceil(item.sameTotalHalf) === item.sameIndex;
        item.sameLowerHalf = item.sameIndex <= item.sameTotalHalf;
        item.sameArcDirection = 1;
        item.sameIndexCorrected = item.sameLowerHalf ? item.sameIndex : item.sameIndex - Math.ceil(item.sameTotalHalf);
      });
    });

    const maxSame = links.concat().sort(sortBy("sameTotal")).slice(-1)[0].sameTotal;

    links.forEach((link) => {
      link.maxSameHalf = Math.round(maxSame / 2);
    });


    return links;
  }

  public initImage(img: string, svg: any) {
    const el = svg.selectAll("image").data([0]);

    el.enter().append("svg:image").attr("xlink:href", img).attr("height", "100%").attr("x", 0).attr("y", 0);

    return el;
  }

  public initLinks(links: any, svg: any) {
    const link = svg
      .append("g")
      .attr("class", "layer links")
      .selectAll("path.outline")
      .data(links, (d: any) => d);

    return this.createLink(link);
  }

  public createLink(link: any) {
    if (!link || (link && !link._enter)) {
      return;
    }

    link = link.enter().append("g").attr("class", "link");

    link
      .append("path")
      .attr("id", (d: any, i: number) => `linkPath${i}`)
      .attr("class", "outline")
      .attr("style", "cursor: pointer")
      .attr("stroke", "#A5ABB6")
      .attr("fill", "none")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#ArrowMarker)");

    link
      .append("text")
      .attr("class", "link-text")
      .attr("fill", "#A5ABB6")
      .append("textPath")
      .attr("pointer-events", "none")
      .attr("href", (d: any, i: number) => `#linkPath${i}`)
      .attr("startOffset", "50%")
      .attr("font-size", 12)
      .attr("text-anchor", "middle")
      .text((d: any) => {
        if (d.relative !== "") {
          return d.relative;
        }
      });

    link
      .append("path")
      .attr("class", "overlay")
      .attr("fill", "none")
      .attr("stroke-opacity", "0.5")
      .attr("stroke-width", "16")
      .style("opacity", "0");

    // init link event
    this.initLinkEvent(link);

    return link;
  }

  public initLinkEvent(link: any) {
    link.on("mouseenter", (d: any, i: number, n: any[]) => {
      const link: any = d3.select(n[i]);

      if (!link._groups[0][0].classList.contains("selected")) {
        link.select(".overlay").attr("stroke", "#68bdf6").style("opacity", 1);
      }
    });

    link.on("mouseleave", (d: any, i: number, n: any[]) => {
      const link: any = d3.select(n[i]);

      if (!link._groups[0][0].classList.contains("selected")) {
        link.select(".overlay").style("opacity", 0);
      }
    });

    link.on("click", (d: any, i: number, n: any[]) => {
      const link: any = d3.select(n[i]);

      if (link._groups[0][0].classList.contains("selected")) {
        link.attr("class", "link");
        link.select(".overlay").style("opacity", 0);
      } else {
        link.attr("class", "link selected");
        link.select(".overlay").attr("stroke", "#FDCC59").style("opacity", 1);
      }

      this.setState({ selectedLink: d });
    });

    link.on("dblclick", () => {
      this.setState({ showLinkModal: true });
    });
  }

  public linkArc(d: any) {
    const dx = d.target.x - d.source.x;
    const dy = d.target.y - d.source.y;
    const dr = Math.sqrt(dx * dx + dy * dy);
    const unevenCorrection = d.sameUneven ? 0 : 0.5;
    const curvature = 2;
    let arc = (1.0 / curvature) * ((dr * d.maxSameHalf) / (d.sameIndexCorrected - unevenCorrection));

    if (d.sameMiddleLink) {
      arc = 0;
    }

    return `M${d.source.x},${d.source.y}A${arc},${arc} 0 0,${d.sameArcDirection} ${d.target.x},${d.target.y}`;
  }

  public drawLink() {
    // console.log('Draw Link');
  }

  public initGraphs(graphs: any, svg: any) {
    const graph = svg
      .append("g")
      .attr("class", "layer graphs")
      .selectAll(".graph")
      .data(graphs, (d: any) => d);

    return this.createGraph(graph);
  }

  public createGraph(graph: any) {
    graph = graph
      .enter()
      .append("g")
      .attr("class", "graph")
      .attr("style", "cursor: pointer")
      .call(
        d3
          .drag()
          .on("start", (d) => this.onDragStarted(d))
          .on("drag", (d) => this.onDragged(d))      
          .on("end", (d) => this.onDragEnded(d))
      );
      console.log(graph);
    graph.append("circle").attr("r", 40).style("fill", (d:any, i:number) => d.color);
    // graph.append('img')
    //     .attr("src", (d:any) => (ProgramAddress + "assets/" + d.img));
    graph.append("svg:image")
        .attr("class", "circle")
        .attr("xlink:href", (d:any) => (ProgramAddress + "assets/" + d.img))
        .attr("x", "-8px")
        .attr('y', '-8px')
        .attr('width', '40px')
        .attr('height', '40px');
    graph
      .append("text")
      .attr("dy", "55")
      .attr("fill", "#000")
      .attr("pointer-events", "none")
      .attr("font-size", "12px")
      .attr("text-anchor", "middle")
      .text((d: any) => d.denomination);

    // graph.append("title").text((d: any) => d.denomination);

    // init graph event
    this.initGraphEvent(graph);

    return graph;
  }

  public initGraphEvent(graph: any) {
    graph.on("mouseenter", (d: any, i: number, n: any[]) => {
      const graph: any = d3.select(n[i]);

      if (graph._groups[0][0].classList.contains("selected")) {
        return;
      }

      graph.select("circle").attr("stroke", (d:any, i:number) => d.color).attr("stroke-width", "12").attr("stroke-opacity", "0.5");
    });

    graph.on("mouseleave", (d: any, i: number, n: any[]) => {
      const graph: any = d3.select(n[i]);

      if (graph._groups[0][0].classList.contains("selected")) {
        return;
      }

      graph.select("circle").attr("stroke-width", 0);
    });


    // graph.on("mouseover", (d: any, i: number, n: any[]) => {
    //   const graph: any = d3.select(n[i]);
    //   const circle = graph.select("circle");

    //   const selected = d3.selectAll(".graph.selected");

    //   this.removeButtonGroup(selected);
    //   if (graph._groups[0][0].classList.contains("selected")) {
    //     circle.attr("stroke-width", 0);
    //     graph.attr("class", "graph");
    //     this.removeButtonGroup(graph);
    //   } else {
    //     circle.attr("stroke-width", 12).attr("stroke", ColorTheme.Cyan);
    //     graph.attr("class", "graph selected");
    //     this.addButtonGroup(graph);
    //   }

    //   this.setState({ selectedGraph: d });
    // });

    graph.on("click", (d: any, i: number, n: any[]) => {
      console.log("Clicked");
      const {have2collapse} = this.state;
      this.chkCollapseOrNot(d);
      console.log(have2collapse);
    });

    graph.on("contextmenu", (d: any, i: number, n: any[]) => {
      d3.event.preventDefault();
      this.setState({ selectedGraph: d, showGraphModal: true });
    });

    
    
  }

  public addArrowMarker(svg: any) {
    const arrow = svg
      .append("marker")
      .attr("id", "ArrowMarker")
      .attr("markerUnits", "strokeWidth")
      .attr("markerWidth", "14")
      .attr("markerHeight", "14")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", "40")
      .attr("refY", "0")
      .attr("orient", "auto");
    const arrowPath = "M0,-4 L10,0 L0,4";

    arrow.append("path").attr("d", arrowPath).attr("fill", "#A5ABB6");
  }

  // public addButtonGroup(graph: any) {
  //   const data = [1, 1, 1, 1];
  //   const buttonGroup = graph.append("g").attr("id", "buttonGroup");

  //   const pieData = d3.pie()(data);
  //   const arcButton = d3.arc().innerRadius(32).outerRadius(64);
  //   const arcText = d3.arc().innerRadius(32).outerRadius(60);

  //   buttonGroup.on("mouseover", () => {
      
  //   })

  //   buttonGroup
  //     .selectAll(".button")
  //     .data(pieData)
  //     .enter()
  //     .append("path")
  //     .attr("class", (d: any, i: number) => `button action-${i}`)
  //     .attr("d", (d: any) => arcButton(d))
  //     .attr("fill", "#c7c5ba")
  //     .style("cursor", "pointer")
  //     .attr("stroke", "#f1f4f9")
  //     .attr("stroke-width", 2)
  //     .attr("stroke-opacity", 0.7);

  //   buttonGroup
  //     .selectAll(".text")
  //     .data(pieData)
  //     .enter()
  //     .append("text")
  //     .attr("class", "text")
  //     .attr("transform", (d: any) => `translate(${arcText.centroid(d)})`)
  //     .attr("text-anchor", "middle")
  //     .attr("fill", "#fff")
  //     .attr("pointer-events", "none")
  //     .attr("font-size", 11)
  //     .text((d: any, i: number) => {
  //       const actions = ["Edit", "Add", "Link", "Delete"];
  //       return actions[i];
  //     });

  //   this.initButtonActions();

  //   return buttonGroup;
  // }

  // public initButtonActions() {
  //   const buttonGroup = d3.select("#buttonGroup");

  //   buttonGroup
  //     .selectAll(".button")
  //     .on("mouseenter", function () {
  //       const button: any = d3.select(this);
  //       button.attr("fill", "#CACACA");
  //       // button.attr('fill', 'red');
  //     })
  //     .on("mouseleave", function () {
  //       const button: any = d3.select(this);
  //       button.attr("fill", "#c7c5ba");
  //       // button.attr('fill', 'yellow');
  //     });

  //   buttonGroup.select(".button.action-0").on("click", (d) => {
  //     this.setState({
  //       selectedGraph: d,
  //       showGraphModal: true,
  //     });
  //   });

  //   buttonGroup.select(".button.action-1").on("click", (d) => this.showAddGraph());

  //   buttonGroup.select(".button.action-2").on("click", (d) => this.showAddLink());

  //   buttonGroup.select(".button.action-3").on("click", (d: any) => {
  //     confirm({
  //       centered: true,
  //       title: `Do you want to delete ${d.name}?`,
  //       onOk: async () => await this.removeGraph(d),
  //     });
  //   });
  // }

  // public removeButtonGroup(graph: any) {
  //   graph.select("#buttonGroup").remove();
  // }

  public updateSimulation() {
    const { links, graphs } = this.state;
    const graphsEl = d3.select(".graphs");
    const linksEl = d3.select(".links");

    // Update graph
    let graph = graphsEl.selectAll(".graph").data(graphs, (d: any) => d);
    graph.exit().remove();
    const graphEnter = this.createGraph(graph);
    graph = graphEnter.merge(graph);

    // Update link
    let link = linksEl.selectAll(".link").data(links, (d: any) => d);
    link.exit().remove();
    const linkEnter = this.createLink(link);
    link = linkEnter.merge(link);

    this.simulation.graphs(graphs).on("tick", () => this.handleTick(link, graph));
    this.simulation.force("link").links(links);
    this.simulation.alpha(1).restart();
  }

  // Add new link
  public showAddLink() {
    this.setState({ showAddLinkModal: true });
  }

  // // TODO: need to do
  // public handleAddLinkOk() {
  //   // const { newLink } = this.state;
  //   // console.log(newLink);
  // }

  // // Add link
  // public async addLink(source: number | string, target: number | string, relative: string) {
  //   try {
  //     const link = {
  //       source,
  //       target,
  //       relative,
  //     };
  //     const { data } = await ApiService.postLink(link);
  //     const links = this.state.links.concat([data]);

  //     this.setState({ links: this.formatLinks(links) }, () => this.updateSimulation());
  //     this.handleAddLinkCancel(false);
  //     message.success("Add Link Success");
  //   } catch (err) {
  //     //message.error(err.message);
  //   }
  // }

  // public handleAddLinkChange(value: any) {
  //   this.setState({
  //     newLink: {
  //       ...this.state.newLink,
  //       relative: value,
  //     },
  //   });
  // }

  // public handleAddLinkCancel(visible: boolean) {
  //   this.setState({
  //     showAddLinkModal: visible,
  //     newLink: {
  //       id: 0,
  //       source: null,
  //       target: null,
  //       relative: "",
  //     },
  //   });
  // }

  public showAddGraph() {
    this.setState({ showAddGraphModal: true });
  }

  // Add graph
  public async handleAddGraphOk(graph: Graph) {
    const { graphs } = this.state;

    try {
      this.setState({ addGraphLoading: true });
      const { data } = await ApiService.postGraph(graph);

      this.setState(
        {
          graphs: graphs.concat([data]),
          addGraphLoading: false,
        },
        () => this.updateSimulation()
      );
      this.handleAddGraphCancel(false);
      message.success("Add Graph Success");
    } catch (err) {
      this.setState({ addGraphLoading: false });
      // message.error(err.message);
    }
  }

  public handleAddGraphCancel(visible: boolean) {
    this.setState({ showAddGraphModal: visible });
  }

  // Update graphs list
  public async handleGraphOk(graph: Graph) {
    const { selectedGraph } = this.state;

    try {
      this.setState({ editGraphLoading: true });
      await ApiService.patchGraph(selectedGraph.id, graph);

      const graphs = this.state.graphs.map((item) => {
        if (item.id === selectedGraph.id) {
          return {
            ...selectedGraph,
            ...graph,
          };
        }
        return item;
      });

      this.setState(
        {
          graphs,
          selectedGraph: {
            ...selectedGraph,
            ...graph,
          },
          editGraphLoading: false,
        },
        () => this.updateSimulation()
      );
      this.handleGraphCancel(false);

      message.success("Update Graph Success");
    } catch (err) {
      this.setState({ editGraphLoading: false });
      // message.error(err.message);
    }
  }

  public handleGraphCancel(visible: boolean) {
    this.setState({ showGraphModal: visible });
  }

  // // Update links list
  // public async handleLinkOk() {
  //   const { selectedLink } = this.state;

  //   try {
  //     const { id, value, source, target, relative } = selectedLink;
  //     const params = {
  //       id,
  //       value,
  //       source: source.id,
  //       target: target.id,
  //       relative,
  //     };

  //     await ApiService.patchLink(id, params);

  //     const links = this.state.links.map((item) => {
  //       if (item.id === selectedLink.id) {
  //         return selectedLink;
  //       }
  //       return item;
  //     });

  //     this.setState({ links }, () => this.updateSimulation());
  //     this.handleLinkCancel(false);
  //     message.success("Update Link Success");
  //   } catch (err) {
  //     // message.error(err.message);
  //   }
  // }

  // public handleLinkChange(value: any) {
  //   const { selectedLink } = this.state;
  //   this.setState({
  //     selectedLink: {
  //       ...selectedLink,
  //       relative: value,
  //     },
  //   });
  // }

  // public handleLinkCancel(visible: boolean) {
  //   this.setState({ showLinkModal: visible });
  // }

  public async removeGraph(graph: any) {
    const { graphs, links } = this.state;

    try {
      const removedGraphs = graphs.filter((d) => d.id === graph.id);
      const removedLinks = links.filter((d) => d.source.id === graph.id || d.target.id === graph.id);

      await Promise.all(removedGraphs.map(async (d: any) => await ApiService.deleteGraph(d.id)));
      // await Promise.all(removedLinks.map(async (d: any) => await ApiService.deleteLink(d.id)));

      this.setState(
        {
          graphs: graphs.filter((d) => d.id !== graph.id),
          links: links.filter((d) => d.source.id !== graph.id && d.target.id !== graph.id),
        },
        () => this.updateSimulation()
      );
      message.success("Remove Graph Success");
    } catch (err) {
      //message.error(err.message);
    }
  }

  public render() {
    const {
      scale,
      selectedGraph,
      selectedLink,
      showAddGraphModal,
      showGraphModal,
      showLinkModal,
      showAddLinkModal,
      addGraphLoading,
      editGraphLoading,
    } = this.state;

    if (this.state.loading) {
      return <Loading />;
    }

    return (
      <Content className="visual-editor">
        <TopTools scale={scale} showAddGraph={() => this.showAddGraph()} />
        <div
          id="Neo4jContainer"
          className="visual-editor-container"
          onClick={(e: SyntheticEvent) => this.restartSimulation(e)}
        />
        {/*Will use these*/}
        {/* <GraphModal
          title="Add Graph"
          loading={addGraphLoading}
          visible={showAddGraphModal}
          onOk={(graph: Graph) => this.handleAddGraphOk(graph)}
          onCancel={(visible: boolean) => this.handleAddGraphCancel(visible)}
        />
        <GraphModal
          title="Edit Graph"
          visible={showGraphModal}
          data={selectedGraph}
          loading={editGraphLoading}
          onOk={(graph: Graph) => this.handleGraphOk(graph)}
          onCancel={(visible: boolean) => this.handleGraphCancel(visible)}
        /> */}
        {/* <LinkModal
          title="Add Link"
          visible={showAddLinkModal}
          onOk={() => this.handleAddLinkOk()}
          onCancel={(visible: boolean) => this.handleAddLinkCancel(visible)}
        />
        <LinkModal
          title="Edit Link"
          visible={showLinkModal}
          data={selectedLink}
          onOk={() => this.handleLinkOk()}
          onCancel={(visible: boolean) => this.handleLinkCancel(visible)}
        /> */}
      </Content>
    );
  }
}

// tslint:disable-next-line: max-file-line-count
export default VisualEditor;
