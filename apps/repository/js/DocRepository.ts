import {IListenablePersistenceLayer} from '../../../web/js/datastore/IListenablePersistenceLayer';
import {Logger} from '../../../web/js/logger/Logger';
import {DocInfo, IDocInfo} from '../../../web/js/metadata/DocInfo';
import {RepoDocInfo} from './RepoDocInfo';
import {Tag} from '../../../web/js/tags/Tag';
import {Tags} from '../../../web/js/tags/Tags';
import {Preconditions} from '../../../web/js/Preconditions';
import {RepoDocInfoIndex} from './RepoDocInfoIndex';
import {TagsDB} from './TagsDB';
import {Optional} from '../../../web/js/util/ts/Optional';

const log = Logger.create();

/**
 * The main interface to the DocRepository including updates, the existing loaded
 * document metadata, and tags database.
 */
export class DocRepository {

    public readonly repoDocs: RepoDocInfoIndex = {};

    public readonly tagsDB: TagsDB = new TagsDB();

    private readonly persistenceLayer: IListenablePersistenceLayer;

    constructor(persistenceLayer: IListenablePersistenceLayer) {
        this.persistenceLayer = persistenceLayer;
        this.init();
    }


    /**
     * Update the in-memory representation of this doc.
     *
     */
    public updateDocInfo(...repoDocInfos: RepoDocInfo[]) {

        for (const repoDocInfo of repoDocInfos) {
            this.repoDocs[repoDocInfo.fingerprint] = repoDocInfo;
        }

        this.updateTagsDB(...repoDocInfos);
    }

    /**
     * Sync the docInfo to disk.
     *
     */
    public async syncDocInfo(docInfo: IDocInfo) {

        if (await this.persistenceLayer.contains(docInfo.fingerprint)) {

            const docMeta = await this.persistenceLayer.getDocMeta(docInfo.fingerprint);

            if (docMeta === undefined) {
                log.warn("Unable to find DocMeta for: ", docInfo.fingerprint);
                return;
            }

            docMeta.docInfo = new DocInfo(docInfo);

            log.info("Writing out updated DocMeta");

            await this.persistenceLayer.syncDocMeta(docMeta);

        }

    }

    /**
     *
     */
    public async syncDocInfoTags(repoDocInfo: RepoDocInfo, tags: Tag[]) {

        Preconditions.assertPresent(repoDocInfo);
        Preconditions.assertPresent(repoDocInfo.docInfo);
        Preconditions.assertPresent(tags);

        repoDocInfo = Object.assign({}, repoDocInfo);
        repoDocInfo.docInfo.tags = Tags.toMap(tags);

        // FIXME: need to send an event so that the UI can refresh since new tags
        // are present.
        this.updateDocInfo(repoDocInfo);

        return this.syncDocInfo(repoDocInfo.docInfo);

    }


    private init() {

        for (const repoDoc of Object.values(this.repoDocs)) {
            this.updateTagsDB(repoDoc);
        }

    }

    private updateTagsDB(...repoDocInfos: RepoDocInfo[]) {

        for (const repoDocInfo of repoDocInfos) {

            // update the tags data.
            Optional.of(repoDocInfo.docInfo.tags)
                .map(tags => {
                    this.tagsDB.register(...Object.values(tags));
                });

        }

    }

}
